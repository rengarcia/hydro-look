#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase 0 reconnaissance for hydro-look.

Captures raw responses from every candidate data source into tests/fixtures/
(verbatim, gzipped when large), writes a machine-readable capture log
(tests/fixtures/recon/capture_log.json), structured findings
(tests/fixtures/recon/findings.json) and a human-readable report
(scripts/recon/RECON_REPORT.md).

It runs from GitHub Actions (.github/workflows/recon.yml) or from any machine
that can reach the Ecuadorian government hosts. A failed fetch never aborts the
run: every target is recorded with its status and error so the report can
answer "does this work?" for each source.

Etiquette: identified User-Agent, one request per second, robots.txt is read
for every host and disallowed paths are skipped (recorded, not fetched).

TLS: the ORDS on generacioncsr.celec.gob.ec:8443 and smec.cenace.gob.ec serve
self-signed certificates (the latter only with weak ciphers). This discovery
script disables verification for those two hosts only and records their
certificate fingerprints so the real pipeline can pin them instead.
"""

from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import re
import socket
import ssl
import subprocess
import sys
import time
from pathlib import Path
from urllib import robotparser
from urllib.parse import urlencode, urljoin, urlparse

import requests
import urllib3
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

UA = "hydro-look-recon/0.1 (+https://github.com/rengarcia/hydro-look; one-off discovery run)"
TZ_EC = dt.timezone(dt.timedelta(hours=-5), name="America/Guayaquil")
ROOT = Path(__file__).resolve().parents[2]
PAUSE_S = 1.0
GZIP_OVER_BYTES = 300_000
MAX_FIXTURE_GZ_BYTES = 2_000_000

ORDS_BASE = "https://generacioncsr.celec.gob.ec:8443/ords"
ORDS_MODULE = f"{ORDS_BASE}/csr/sardomcsr"
CELEC_WIDE = "https://generacioncsr.celec.gob.ec/graficasproduccionCELEC/"
CELEC_SUR = "https://generacioncsr.celec.gob.ec/graficasproduccion/"
SMEC_BASE = "https://smec.cenace.gob.ec/SMEC/"
OPERATIVA = "https://www.cenace.gob.ec/info-operativa/InformacionOperativa.htm"
LEGACY_TLS_PREFIXES = ("https://generacioncsr.celec.gob.ec:8443", "https://smec.cenace.gob.ec")

KNOWN_MRIDS = [
    ("Mazar", "cota_masl", 30031),
    ("Mazar", "caudal_m3s", 30538),
    ("Amaluza", "cota_masl", 24019),
    ("Amaluza", "caudal_m3s", 24811),
    ("Sopladora", "cota_masl", 90919),
    ("Sopladora", "caudal_m3s", 90537),
]
PLANT_TERMS = [
    "mazar", "amaluza", "molino", "paute", "sopladora", "minas", "san francisco", "agoy",
    "manduriacu", "coca codo", "sinclair", "pisayambo", "pucar", "daule", "peripa", "laniado",
    "delsitanisagua", "toachi", "baba", "cota", "caudal", "produc", "potencia", "energ",
]
SMEC_INFORME1 = SMEC_BASE + "ResultadoInforme1.do"
OPEN_METEO = {
    "archive": "https://archive-api.open-meteo.com/v1/archive?latitude=-2.6&longitude=-78.6&start_date=2024-01-01&end_date=2024-01-31&daily=precipitation_sum,temperature_2m_mean&timezone=America%2FGuayaquil",
    "forecast": "https://api.open-meteo.com/v1/forecast?latitude=-2.6&longitude=-78.6&daily=precipitation_sum&forecast_days=16&timezone=America%2FGuayaquil",
    "seasonal": "https://seasonal-api.open-meteo.com/v1/seasonal?latitude=-2.6&longitude=-78.6&daily=precipitation_sum&forecast_days=183&timezone=America%2FGuayaquil",
}
NOAA = {
    "oni_psl": "https://psl.noaa.gov/data/correlation/oni.data",
    "oni_cpc": "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
}
MIRRORS = {
    "jordanvt18_estado": "https://raw.githubusercontent.com/jordanvt18/cotas-embalses-ecuador/main/docs/estado.json",
    "tefaceli_historico": "https://raw.githubusercontent.com/tefaceli/scraper-mazar/main/data/historico.json",
    "tefaceli_en_vivo": "https://raw.githubusercontent.com/tefaceli/scraper-mazar/main/data/en_vivo.json",
}
OPEN_DATA = {
    "ckan_cenace": "https://www.datosabiertos.gob.ec/api/3/action/package_search?fq=organization:cenace&rows=100",
    "ckan_bnee": "https://www.datosabiertos.gob.ec/api/3/action/package_search?q=balance%20nacional%20energia%20electrica&rows=20",
    "cenace_dataset_page": "https://www.datosabiertos.gob.ec/dataset/http-portalsimem-cenace-corp",
    "arconel_bnee_1": "https://www.controlrecursosyenergia.gob.ec/balance-nacional-de-energia-electrica/",
    "arconel_bnee_2": "https://arconel.gob.ec/balance-nacional-de-energia-electrica/",
}


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


class LegacyTLSAdapter(HTTPAdapter):
    """SECLEVEL=1 and no chain verification. Discovery only; the pipeline will pin."""

    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.set_ciphers("DEFAULT@SECLEVEL=1")
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


class Recorder:
    def __init__(self, fixtures: Path, capture: Path, respect_robots: bool = True):
        self.fixtures = fixtures
        self.capture = capture
        self.respect_robots = respect_robots
        self.log: list[dict] = []
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": UA, "Accept": "*/*"})
        for prefix in LEGACY_TLS_PREFIXES:
            self.session.mount(prefix, LegacyTLSAdapter())
        self._robots: dict[str, robotparser.RobotFileParser | None] = {}
        self.robots_verdicts: list[dict] = []

    # -- helpers -----------------------------------------------------------
    @staticmethod
    def _verify(url: str) -> bool:
        return not url.startswith(LEGACY_TLS_PREFIXES)

    def _save(self, rel: str, body: bytes) -> str:
        cap = self.capture / rel
        cap.parent.mkdir(parents=True, exist_ok=True)
        cap.write_bytes(body)
        if len(body) <= GZIP_OVER_BYTES:
            fx = self.fixtures / rel
            fx.parent.mkdir(parents=True, exist_ok=True)
            fx.write_bytes(body)
            return _rel(fx)
        gz = gzip.compress(body, compresslevel=9)
        if len(gz) <= MAX_FIXTURE_GZ_BYTES:
            fx = self.fixtures / (rel + ".gz")
            fx.parent.mkdir(parents=True, exist_ok=True)
            fx.write_bytes(gz)
            return _rel(fx)
        return f"capture-only ({len(body)} B raw, {len(gz)} B gz)"

    def robots_for(self, url: str) -> tuple[bool, str]:
        p = urlparse(url)
        origin = f"{p.scheme}://{p.netloc}"
        if origin not in self._robots:
            rp = robotparser.RobotFileParser()
            txt, status = None, None
            try:
                r = self.session.get(origin + "/robots.txt", timeout=30, verify=self._verify(origin))
                status = r.status_code
                if r.ok and r.text.strip() and "<html" not in r.text[:500].lower():
                    txt = r.text
            except Exception as error:  # noqa: BLE001
                status = f"error: {type(error).__name__}"
            if txt:
                rp.parse(txt.splitlines())
                self._robots[origin] = rp
            else:
                self._robots[origin] = None
            self._save(f"robots/{p.netloc.replace(':', '_')}.txt", (txt or f"# no usable robots.txt (status {status})\n").encode())
            self.log.append({"key": f"robots:{p.netloc}", "url": origin + "/robots.txt", "status": status, "bytes": len(txt or ""), "saved": f"robots/{p.netloc.replace(':', '_')}.txt"})
            time.sleep(PAUSE_S)
        rp = self._robots[origin]
        if rp is None:
            verdict = (True, "no robots.txt")
        else:
            ok_ua, ok_all = rp.can_fetch(UA, url), rp.can_fetch("*", url)
            verdict = (ok_ua and ok_all, f"can_fetch(ua)={ok_ua} can_fetch(*)={ok_all}")
        self.robots_verdicts.append({"url": url, "allowed": verdict[0], "detail": verdict[1]})
        return verdict

    def fetch(self, key: str, url: str, *, params: dict | None = None, save_as: str | None = None, timeout: int = 45):
        full = f"{url}?{urlencode(params)}" if params else url
        rec: dict = {"key": key, "url": full, "status": None, "bytes": 0, "elapsed_s": None, "saved": None, "error": None, "content_type": None}
        if self.respect_robots:
            allowed, why = self.robots_for(url)
            rec["robots"] = why
            if not allowed:
                rec["error"] = "skipped: disallowed by robots.txt"
                self.log.append(rec)
                print(f"[skip] {key}: robots disallow", flush=True)
                return rec, None
        t0 = time.monotonic()
        try:
            r = self.session.get(url, params=params, timeout=timeout, verify=self._verify(url))
            rec.update(status=r.status_code, bytes=len(r.content), content_type=r.headers.get("content-type"), elapsed_s=round(time.monotonic() - t0, 2), sha256=hashlib.sha256(r.content).hexdigest(), final_url=r.url)
            if save_as:
                rec["saved"] = self._save(save_as, r.content)
            print(f"[{r.status_code}] {key}: {rec['bytes']} B in {rec['elapsed_s']}s", flush=True)
            self.log.append(rec)
            time.sleep(PAUSE_S)
            return rec, r
        except Exception as error:  # noqa: BLE001
            rec["error"] = f"{type(error).__name__}: {error}"[:300]
            rec["elapsed_s"] = round(time.monotonic() - t0, 2)
            print(f"[ERR] {key}: {rec['error']}", flush=True)
            self.log.append(rec)
            time.sleep(PAUSE_S)
            return rec, None


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------
def month_window(year: int, month: int) -> dict:
    start = dt.date(year, month, 1)
    nxt = dt.date(year + (month == 12), (month % 12) + 1, 1)
    return {"fechaInicio": f"{start.isoformat()}T00:00:00.000Z", "fechaFin": f"{nxt.isoformat()}T00:00:00.000Z", "fecha": f"{start.strftime('%d/%m/%Y')} 00:00:00"}


def day_window(day: dt.date) -> dict:
    nxt = day + dt.timedelta(days=1)
    return {"fechaInicio": f"{day.isoformat()}T06:00:00.000Z", "fechaFin": f"{nxt.isoformat()}T05:00:00.000Z", "fecha": f"{day.strftime('%d/%m/%Y')} 01:00:00"}


def summarize_items(r: requests.Response | None) -> dict:
    if r is None:
        return {"n_items": None}
    try:
        data = r.json()
    except Exception:  # noqa: BLE001
        return {"parse_error": True, "head": r.text[:200]}
    items = data.get("items", []) if isinstance(data, dict) else []
    vals = [i.get("valueedit") for i in items]
    nums = [v for v in vals if isinstance(v, (int, float))]
    return {
        "top_level_keys": sorted(data.keys()) if isinstance(data, dict) else type(data).__name__,
        "n_items": len(items),
        "item_keys": sorted(items[0].keys()) if items else [],
        "first_ts": items[0].get("loctimestamp") if items else None,
        "last_ts": items[-1].get("loctimestamp") if items else None,
        "n_null": sum(v is None for v in vals),
        "min": min(nums) if nums else None,
        "max": max(nums) if nums else None,
        "sample": items[:2],
    }


def section_tls(rec: Recorder) -> dict:
    out = {}
    for host, port in [("generacioncsr.celec.gob.ec", 8443), ("generacioncsr.celec.gob.ec", 443), ("smec.cenace.gob.ec", 443), ("www.cenace.gob.ec", 443)]:
        info: dict = {"host": host, "port": port}
        try:
            ctx = ssl.create_default_context()
            ctx.set_ciphers("DEFAULT@SECLEVEL=1")
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            with socket.create_connection((host, port), timeout=20) as sock, ctx.wrap_socket(sock, server_hostname=host) as ss:
                der = ss.getpeercert(binary_form=True)
                info.update(tls_version=ss.version(), cipher=ss.cipher())
            info["sha256"] = hashlib.sha256(der).hexdigest()
            pem = ssl.DER_cert_to_PEM_cert(der)
            try:
                proc = subprocess.run(["openssl", "x509", "-noout", "-subject", "-issuer", "-startdate", "-enddate"], input=pem.encode(), capture_output=True, timeout=20)
                info["x509"] = proc.stdout.decode(errors="replace").strip()
            except Exception as error:  # noqa: BLE001
                info["x509_error"] = str(error)
            try:
                vctx = ssl.create_default_context()
                with socket.create_connection((host, port), timeout=20) as sock, vctx.wrap_socket(sock, server_hostname=host):
                    info["verifies_with_system_ca"] = True
            except Exception as error:  # noqa: BLE001
                info["verifies_with_system_ca"] = False
                info["verify_error"] = f"{type(error).__name__}: {error}"[:200]
        except Exception as error:  # noqa: BLE001
            info["error"] = f"{type(error).__name__}: {error}"[:200]
        out[f"{host}:{port}"] = info
        print(f"[tls] {host}:{port} -> {info.get('sha256', info.get('error'))}", flush=True)
    rec._save("tls/fingerprints.json", json.dumps(out, indent=2, ensure_ascii=False).encode())
    return out


def section_ords(rec: Recorder) -> dict:
    now_ec = dt.datetime.now(TZ_EC)
    cur = (now_ec.year, now_ec.month)
    prev = (now_ec.year - (now_ec.month == 1), (now_ec.month - 2) % 12 + 1)
    out: dict = {"known": {}, "earliest_probe": {}, "catalog": {}, "hourly": {}}
    for plant, var, mrid in KNOWN_MRIDS:
        for (y, m) in (cur, prev):
            r_, r = rec.fetch(f"ords:mesh24:{mrid}:{y}-{m:02d}", f"{ORDS_MODULE}/pointValuesMesH24", params=month_window(y, m), save_as=f"celec_ords/mesh24_{mrid}_{y}-{m:02d}.json")
            out["known"][f"{plant}/{var}/{mrid}/{y}-{m:02d}"] = summarize_items(r)
    yesterday = (now_ec - dt.timedelta(days=1)).date()
    for mrid in (30031, 30538):
        r_, r = rec.fetch(f"ords:hourly:{mrid}:{yesterday}", f"{ORDS_MODULE}/pointValues", params=day_window(yesterday), save_as=f"celec_ords/pointvalues_{mrid}_{yesterday}.json")
        out["hourly"][f"{mrid}/{yesterday}"] = summarize_items(r)
    earliest = None
    for y in range(2015, 2023):
        r_, r = rec.fetch(f"ords:earliest:30031:{y}-01", f"{ORDS_MODULE}/pointValuesMesH24", params=month_window(y, 1), save_as=f"celec_ords/mesh24_30031_{y}-01.json")
        s = summarize_items(r)
        out["earliest_probe"][f"30031/{y}-01"] = {"n_items": s.get("n_items"), "n_null": s.get("n_null"), "min": s.get("min"), "max": s.get("max")}
        if earliest is None and (s.get("n_items") or 0) > (s.get("n_null") or 0):
            earliest = y
    out["earliest_year_with_values_30031"] = earliest
    for plant, var, mrid in KNOWN_MRIDS:
        if mrid == 30031:
            continue
        for y in sorted({earliest or 2022, 2022}):
            r_, r = rec.fetch(f"ords:earliest:{mrid}:{y}-01", f"{ORDS_MODULE}/pointValuesMesH24", params=month_window(y, 1), save_as=f"celec_ords/mesh24_{mrid}_{y}-01.json")
            s = summarize_items(r)
            out["earliest_probe"][f"{mrid}/{y}-01"] = {"n_items": s.get("n_items"), "n_null": s.get("n_null"), "min": s.get("min"), "max": s.get("max")}
    for key, url in {
        "ords_root": f"{ORDS_BASE}/",
        "csr_root": f"{ORDS_BASE}/csr/",
        "metadata_catalog": f"{ORDS_BASE}/csr/metadata-catalog/",
        "metadata_catalog_module": f"{ORDS_BASE}/csr/metadata-catalog/sardomcsr/",
        "module_root": f"{ORDS_MODULE}/",
        "mesh24_no_params": f"{ORDS_MODULE}/pointValuesMesH24",
        "open_api": f"{ORDS_BASE}/csr/open-api-catalog/sardomcsr/",
    }.items():
        r_, r = rec.fetch(f"ords:{key}", url, save_as=f"celec_ords/{key}.txt")
        out["catalog"][key] = {"status": r_.get("status"), "error": r_.get("error"), "content_type": r_.get("content_type"), "head": (r.text[:600] if r is not None else None)}
    return out


def scan_bundle(text: str) -> dict:
    hits: dict = {"mrid_windows": [], "mrid_numbers": [], "plants": {}, "csv_windows": [], "ords_urls": [], "assets_json": [], "http_urls": []}
    for m in list(re.finditer(r"mrid", text, flags=re.I))[:400]:
        window = text[max(0, m.start() - 160): m.end() + 160]
        hits["mrid_windows"].append(window)
        hits["mrid_numbers"] += re.findall(r"(?<![:\d])\d{4,6}(?!\d)", window)
    hits["mrid_numbers"] = sorted(set(hits["mrid_numbers"]), key=int)
    for term in PLANT_TERMS:
        windows = [text[max(0, m.start() - 200): m.end() + 200] for m in list(re.finditer(re.escape(term), text, flags=re.I))[:15]]
        if windows:
            hits["plants"][term] = windows
    hits["plant_counts"] = {t: len(re.findall(re.escape(t), text, flags=re.I)) for t in PLANT_TERMS}
    for m in list(re.finditer(r"csv", text, flags=re.I))[:40]:
        hits["csv_windows"].append(text[max(0, m.start() - 200): m.end() + 200])
    hits["ords_urls"] = sorted(set(re.findall(r"https?://[^\"'\s)]*ords[^\"'\s)]*", text)) | set(re.findall(r"/ords/[^\"'\s)]*", text)))
    hits["assets_json"] = sorted(set(re.findall(r"assets/[^\"'\s)]+\.json", text)))
    hits["http_urls"] = sorted(set(u for u in re.findall(r"https?://[^\"'\s)]{8,120}", text) if "celec" in u or "cenace" in u or ":8443" in u))[:80]
    return hits


def section_celec_web(rec: Recorder) -> dict:
    out: dict = {}
    for app, base in (("celec_wide", CELEC_WIDE), ("celec_sur", CELEC_SUR)):
        entry: dict = {"index": None, "scripts": [], "scans": {}}
        r_, r = rec.fetch(f"web:{app}:index", base, save_as=f"celec_web/{app}_index.html")
        entry["index"] = {"status": r_.get("status"), "error": r_.get("error"), "bytes": r_.get("bytes")}
        if r is None or not r.ok:
            out[app] = entry
            continue
        soup = BeautifulSoup(r.text, "html.parser")
        entry["title"] = soup.title.get_text(strip=True) if soup.title else None
        refs = [s.get("src") for s in soup.find_all("script") if s.get("src")] + [l.get("href") for l in soup.find_all("link") if l.get("href")]
        entry["refs"] = refs
        merged = scan_bundle(r.text)
        for ref in refs:
            if not (ref.endswith(".js") or ref.endswith(".json")):
                continue
            url = urljoin(base, ref)
            if urlparse(url).netloc != urlparse(base).netloc:
                entry["scripts"].append({"ref": ref, "skipped": "cross-origin"})
                continue
            name = Path(urlparse(url).path).name
            s_, s = rec.fetch(f"web:{app}:{name}", url, save_as=f"celec_web/{app}/{name}", timeout=90)
            item = {"ref": ref, "status": s_.get("status"), "bytes": s_.get("bytes"), "saved": s_.get("saved")}
            if s is not None and s.ok:
                scan = scan_bundle(s.text)
                item["mrid_hits"] = len(scan["mrid_windows"])
                item["mrid_numbers"] = scan["mrid_numbers"]
                item["plant_counts"] = {k: v for k, v in scan["plant_counts"].items() if v}
                item["ords_urls"] = scan["ords_urls"]
                item["assets_json"] = scan["assets_json"]
                entry["scans"][name] = scan
                for k in ("mrid_windows", "csv_windows"):
                    merged[k] += scan[k]
                merged["mrid_numbers"] = sorted(set(merged["mrid_numbers"]) | set(scan["mrid_numbers"]), key=int)
                merged["ords_urls"] = sorted(set(merged["ords_urls"]) | set(scan["ords_urls"]))
                merged["assets_json"] = sorted(set(merged["assets_json"]) | set(scan["assets_json"]))
                merged["http_urls"] = sorted(set(merged["http_urls"]) | set(scan["http_urls"]))
                for t, ws in scan["plants"].items():
                    merged["plants"].setdefault(t, []).extend(ws[:5])
            entry["scripts"].append(item)
        for asset in merged["assets_json"][:20]:
            a_, a = rec.fetch(f"web:{app}:asset:{Path(asset).name}", urljoin(base, asset), save_as=f"celec_web/{app}/{asset.replace('/', '_')}")
            entry.setdefault("assets", []).append({"asset": asset, "status": a_.get("status"), "bytes": a_.get("bytes"), "head": (a.text[:400] if a is not None else None)})
        entry["merged"] = {"mrid_numbers": merged["mrid_numbers"], "n_mrid_windows": len(merged["mrid_windows"]), "ords_urls": merged["ords_urls"], "assets_json": merged["assets_json"], "http_urls": merged["http_urls"], "n_csv_windows": len(merged["csv_windows"])}
        rec._save(f"celec_web/{app}_scan.json", json.dumps({"merged": merged, "per_script": entry["scans"]}, indent=1, ensure_ascii=False).encode())
        entry.pop("scans")
        out[app] = entry
    return out


def smec_rows(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for td in soup.find_all("td"):
        cls = " ".join(td.get("class", []))
        if "bordegris" in cls and str(td.get("align", "")).lower() == "left":
            sib = td.find_next_sibling("td")
            rows.append({"label": td.get_text(strip=True), "value": sib.get_text(strip=True) if sib else None})
    all_rows = []
    for tr in soup.find_all("tr")[:120]:
        cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
        if any(cells):
            all_rows.append(cells[:8])
    return {
        "title": soup.title.get_text(strip=True) if soup.title else None,
        "n_tables": len(soup.find_all("table")),
        "th": [th.get_text(" ", strip=True) for th in soup.find_all("th")][:60],
        "rows": rows,
        "all_rows": all_rows,
        "links": sorted(set(a.get("href") for a in soup.find_all("a") if a.get("href")))[:80],
        "forms": [{"action": f.get("action"), "inputs": [i.get("name") for i in f.find_all(["input", "select"])]} for f in soup.find_all("form")][:10],
        "text_head": soup.get_text(" ", strip=True)[:700],
    }


def section_smec(rec: Recorder) -> dict:
    now_ec = dt.datetime.now(TZ_EC)
    yesterday = (now_ec - dt.timedelta(days=1)).date()
    dates = [yesterday, yesterday - dt.timedelta(days=1), dt.date(2024, 10, 15), dt.date(2023, 11, 5), dt.date(2022, 1, 15), dt.date(2021, 6, 15), dt.date(2019, 1, 15)]
    out: dict = {"informe1": {}, "probes": {}, "menu": {}}
    for d in dates:
        r_, r = rec.fetch(f"smec:informe1:{d}", SMEC_INFORME1, params={"fecha": d.strftime("%Y/%m/%d")}, save_as=f"cenace_smec/informe1_{d}.html")
        info = {"status": r_.get("status"), "error": r_.get("error"), "bytes": r_.get("bytes")}
        if r is not None and r.ok:
            info.update(smec_rows(r.text))
        out["informe1"][str(d)] = info
    for n in range(2, 13):
        r_, r = rec.fetch(f"smec:informe{n}", f"{SMEC_BASE}ResultadoInforme{n}.do", params={"fecha": yesterday.strftime("%Y/%m/%d")}, save_as=f"cenace_smec/informe{n}_{yesterday}.html")
        info = {"status": r_.get("status"), "error": r_.get("error"), "bytes": r_.get("bytes")}
        if r is not None and r.ok:
            parsed = smec_rows(r.text)
            info.update(title=parsed["title"], n_tables=parsed["n_tables"], n_rows=len(parsed["rows"]), th=parsed["th"][:12], text_head=parsed["text_head"][:300], row_labels=[x["label"] for x in parsed["rows"]][:40])
        out["probes"][f"informe{n}"] = info
    for key, url in {"smec_root": SMEC_BASE, "host_root": "https://smec.cenace.gob.ec/", "index_jsp": SMEC_BASE + "index.jsp", "menu_do": SMEC_BASE + "Menu.do"}.items():
        r_, r = rec.fetch(f"smec:{key}", url, save_as=f"cenace_smec/{key}.html")
        info = {"status": r_.get("status"), "error": r_.get("error"), "bytes": r_.get("bytes"), "final_url": r_.get("final_url")}
        if r is not None and r.ok:
            parsed = smec_rows(r.text)
            info.update(title=parsed["title"], links=parsed["links"], forms=parsed["forms"], text_head=parsed["text_head"][:300])
        out["menu"][key] = info
    return out


def section_operativa(rec: Recorder) -> dict:
    now_ec = dt.datetime.now(TZ_EC)
    stamp = now_ec.strftime("%Y-%m-%dT%H%M")
    r_, r = rec.fetch("operativa:page", OPERATIVA, save_as=f"cenace_operativa/InformacionOperativa_{stamp}.html", timeout=90)
    out: dict = {"captured_local": now_ec.isoformat(timespec="minutes"), "status": r_.get("status"), "error": r_.get("error"), "bytes": r_.get("bytes"), "saved": r_.get("saved")}
    if r is None or not r.ok:
        return out
    html = r.text
    out["n_plotly_newplot"] = len(re.findall(r"Plotly\.newPlot\(", html))
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    out["title"] = soup.title.get_text(strip=True) if soup.title else None
    out["text_head"] = text[:3000]
    out["lines_with_mw"] = [ln for ln in text.splitlines() if re.search(r"\bMWh?\b", ln)][:60]
    out["lines_with_numbers"] = [ln for ln in text.splitlines() if re.search(r"\d{1,3}(?:[.,]\d{3})+", ln)][:60]
    out["ids_classes_head"] = [{"tag": t.name, "id": t.get("id"), "class": t.get("class")} for t in soup.find_all(True, limit=400) if t.get("id") or t.get("class")][:80]
    return out


def section_covariates(rec: Recorder) -> dict:
    out: dict = {}
    for key, url in {**{f"open_meteo:{k}": v for k, v in OPEN_METEO.items()}, **{f"noaa:{k}": v for k, v in NOAA.items()}}.items():
        folder, name = key.split(":")
        r_, r = rec.fetch(key, url, save_as=f"{folder}/{name}.{'json' if 'open_meteo' in key else 'txt'}")
        info = {"status": r_.get("status"), "error": r_.get("error"), "bytes": r_.get("bytes")}
        if r is not None and r.ok and "open_meteo" in key:
            try:
                data = r.json()
                info["keys"] = sorted(data.keys())
                info["daily_keys"] = sorted(data.get("daily", {}).keys()) if isinstance(data.get("daily"), dict) else None
            except Exception as error:  # noqa: BLE001
                info["parse_error"] = str(error)[:200]
        elif r is not None and r.ok:
            info["head"] = r.text[:300]
        out[key] = info
    return out


def section_mirrors(rec: Recorder) -> dict:
    out = {}
    for key, url in MIRRORS.items():
        r_, r = rec.fetch(f"mirror:{key}", url, save_as=f"mirrors/{key}.json")
        out[key] = {"status": r_.get("status"), "error": r_.get("error"), "bytes": r_.get("bytes")}
    return out


def section_open_data(rec: Recorder) -> dict:
    out: dict = {}
    for key, url in OPEN_DATA.items():
        ext = "json" if key.startswith("ckan") else "html"
        r_, r = rec.fetch(f"opendata:{key}", url, save_as=f"open_data/{key}.{ext}", timeout=90)
        info = {"status": r_.get("status"), "error": r_.get("error"), "bytes": r_.get("bytes")}
        if r is not None and r.ok:
            if ext == "json":
                try:
                    data = r.json()
                    results = data.get("result", {}).get("results", [])
                    info["count"] = data.get("result", {}).get("count")
                    info["datasets"] = [{"title": d.get("title"), "name": d.get("name"), "modified": d.get("metadata_modified"), "resources": [{"name": res.get("name"), "format": res.get("format"), "url": res.get("url"), "last_modified": res.get("last_modified")} for res in d.get("resources", [])][:12]} for d in results][:40]
                except Exception as error:  # noqa: BLE001
                    info["parse_error"] = str(error)[:200]
            else:
                soup = BeautifulSoup(r.text, "html.parser")
                info["title"] = soup.title.get_text(strip=True) if soup.title else None
                info["file_links"] = sorted(set(a.get("href") for a in soup.find_all("a") if a.get("href") and re.search(r"\.(xlsx?|csv|pdf|zip)(\?|$)", a.get("href"), flags=re.I)))[:80]
        out[key] = info
    return out


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
def md_table(headers: list[str], rows: list[list]) -> str:
    esc = lambda v: str(v).replace("|", "\\|").replace("\n", " ") if v is not None else ""  # noqa: E731
    lines = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    lines += ["| " + " | ".join(esc(c) for c in row) + " |" for row in rows]
    return "\n".join(lines)


def _section(findings: dict, name: str, _default=None) -> dict:
    """A section's findings, or {} when it errored (the error is listed separately)."""
    sec = findings.get(name)
    return sec if isinstance(sec, dict) and "section_error" not in sec else {}


def write_report(path: Path, rec: Recorder, findings: dict, started: dt.datetime) -> None:
    parts: list[str] = []
    for name, render in REPORT_SECTIONS:
        try:
            parts.append(render(rec, findings, started))
        except Exception as error:  # noqa: BLE001
            parts.append(f"## {name}\n\n_report section failed: {type(error).__name__}: {error}_\n")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(parts), encoding="utf-8")


def _r_header(rec, findings, started):
    now_utc = dt.datetime.now(dt.timezone.utc)
    lines = ["# Phase 0 reconnaissance report", "", f"Generated {now_utc.isoformat(timespec='seconds')} (UTC) · {now_utc.astimezone(TZ_EC).isoformat(timespec='seconds')} (Ecuador) · started {started.isoformat(timespec='seconds')} · {len(rec.log)} requests.", "", "Raw responses: `tests/fixtures/` (gzipped when large). Structured findings: `tests/fixtures/recon/findings.json`. Full log: `tests/fixtures/recon/capture_log.json`.", ""]
    return "\n".join(lines)

def _r_1(rec, findings, started):
    lines = []
    lines += ["## 1. Every request", "", md_table(["key", "status", "bytes", "s", "saved", "error"], [[r.get("key"), r.get("status"), r.get("bytes"), r.get("elapsed_s"), r.get("saved"), r.get("error")] for r in rec.log]), ""]

    return "\n".join(lines)

def _r_2(rec, findings, started):
    lines = []
    lines += ["## 2. robots.txt verdicts", "", md_table(["url", "allowed", "detail"], [[v["url"], v["allowed"], v["detail"]] for v in rec.robots_verdicts]), ""]

    return "\n".join(lines)

def _r_4(rec, findings, started):
    lines = []
    tls = _section(findings, "tls", {})
    if tls:
        lines += ["## 3. TLS", "", md_table(["host", "sha256", "tls", "cipher", "system CA verifies", "x509 / error"], [[k, v.get("sha256"), v.get("tls_version"), (v.get("cipher") or [None])[0], v.get("verifies_with_system_ca"), v.get("x509") or v.get("error") or v.get("verify_error")] for k, v in tls.items()]), ""]

    return "\n".join(lines)

def _r_5(rec, findings, started):
    lines = []
    ords = _section(findings, "ords", {})
    if ords:
        lines += ["## 4. CELEC ORDS", "", f"Earliest January with non-null values for mrid 30031: **{ords.get('earliest_year_with_values_30031')}**", "", "### 4.1 Known mrids, current and previous month (MesH24)", "", md_table(["plant/var/mrid/month", "items", "nulls", "min", "max", "first ts", "last ts", "item keys"], [[k, v.get("n_items"), v.get("n_null"), v.get("min"), v.get("max"), v.get("first_ts"), v.get("last_ts"), ",".join(v.get("item_keys") or [])] for k, v in ords.get("known", {}).items()]), "", "### 4.2 Hourly endpoint (pointValues), yesterday", "", md_table(["mrid/day", "items", "nulls", "min", "max", "first ts", "last ts"], [[k, v.get("n_items"), v.get("n_null"), v.get("min"), v.get("max"), v.get("first_ts"), v.get("last_ts")] for k, v in ords.get("hourly", {}).items()]), "", "### 4.3 Earliest-year probes (January of each year)", "", md_table(["mrid/month", "items", "nulls", "min", "max"], [[k, v.get("n_items"), v.get("n_null"), v.get("min"), v.get("max")] for k, v in ords.get("earliest_probe", {}).items()]), "", "### 4.4 Catalog / metadata probes", "", md_table(["probe", "status", "content-type", "head"], [[k, v.get("status") or v.get("error"), v.get("content_type"), (v.get("head") or "")[:300]] for k, v in ords.get("catalog", {}).items()]), ""]

    return "\n".join(lines)

def _r_6(rec, findings, started):
    lines = []
    web = _section(findings, "celec_web", {})
    if web:
        lines += ["## 5. CELEC dashboards (Angular bundles)", ""]
        for app, entry in web.items():
            lines += [f"### {app} — `{entry.get('title')}` (index status {entry.get('index', {}).get('status')}, {entry.get('index', {}).get('error') or 'ok'})", ""]
            if entry.get("scripts"):
                lines += [md_table(["script", "status", "bytes", "mrid hits", "mrid-adjacent numbers", "ords urls", "assets json", "plant term counts"], [[s.get("ref"), s.get("status") or s.get("skipped"), s.get("bytes"), s.get("mrid_hits"), ",".join(s.get("mrid_numbers") or []), " ".join(s.get("ords_urls") or []), " ".join(s.get("assets_json") or []), json.dumps(s.get("plant_counts") or {}, ensure_ascii=False)] for s in entry["scripts"]]), ""]
            merged = entry.get("merged") or {}
            lines += [f"- mrid-adjacent numbers (all bundles): `{', '.join(merged.get('mrid_numbers') or []) or '—'}`", f"- ORDS URLs found: `{' '.join(merged.get('ords_urls') or []) or '—'}`", f"- celec/cenace URLs found: `{' '.join(merged.get('http_urls') or []) or '—'}`", f"- assets JSON referenced: `{' '.join(merged.get('assets_json') or []) or '—'}`", f"- windows around `mrid`: {merged.get('n_mrid_windows')}, around `csv`: {merged.get('n_csv_windows')} (see `tests/fixtures/celec_web/{app}_scan.json`)", ""]
            for a in entry.get("assets", []) or []:
                lines += [f"- asset `{a['asset']}` → {a['status']} ({a['bytes']} B): `{(a.get('head') or '')[:200]}`"]
            lines += [""]

    return "\n".join(lines)

def _r_7(rec, findings, started):
    lines = []
    smec = _section(findings, "smec", {})
    if smec:
        lines += ["## 6. CENACE SMEC daily balance", "", "### 6.1 ResultadoInforme1.do by date", "", md_table(["date", "status", "bytes", "tables", "labelled rows", "title"], [[d, v.get("status") or v.get("error"), v.get("bytes"), v.get("n_tables"), len(v.get("rows") or []), v.get("title")] for d, v in smec.get("informe1", {}).items()]), ""]
        for d, v in smec.get("informe1", {}).items():
            if v.get("rows"):
                lines += [f"#### Rows on {d}", "", md_table(["label", "value"], [[r["label"], r["value"]] for r in v["rows"]]), ""]
                if v.get("all_rows"):
                    lines += ["<details><summary>All table rows (first 120)</summary>", "", md_table(["cells"], [[" · ".join(c) for c in v["all_rows"]]]), "", "</details>", ""]
                break
        lines += ["### 6.2 Other report numbers (yesterday)", "", md_table(["report", "status", "bytes", "title", "tables", "rows", "labels", "text head"], [[k, v.get("status") or v.get("error"), v.get("bytes"), v.get("title"), v.get("n_tables"), v.get("n_rows"), " · ".join(v.get("row_labels") or [])[:300], (v.get("text_head") or "")[:200]] for k, v in smec.get("probes", {}).items()]), "", "### 6.3 Menu / root pages", "", md_table(["page", "status", "final url", "title", "links", "forms"], [[k, v.get("status") or v.get("error"), v.get("final_url"), v.get("title"), " ".join(v.get("links") or [])[:400], json.dumps(v.get("forms") or [], ensure_ascii=False)[:300]] for k, v in smec.get("menu", {}).items()]), ""]

    return "\n".join(lines)

def _r_8(rec, findings, started):
    lines = []
    op = _section(findings, "operativa", {})
    if op:
        lines += ["## 7. CENACE Información Operativa", "", f"Captured at {op.get('captured_local')} local · status {op.get('status') or op.get('error')} · {op.get('bytes')} B · Plotly.newPlot calls: {op.get('n_plotly_newplot')} · title `{op.get('title')}`", "", "Lines mentioning MW/MWh:", ""] + [f"- {ln}" for ln in op.get("lines_with_mw", [])] + ["", "Lines with thousands-formatted numbers:", ""] + [f"- {ln}" for ln in op.get("lines_with_numbers", [])] + ["", "<details><summary>Visible text head</summary>", "", "```", op.get("text_head") or "", "```", "", "</details>", ""]

    return "\n".join(lines)

def _r_9(rec, findings, started):
    lines = []
    cov = _section(findings, "covariates", {})
    if cov:
        lines += ["## 8. Covariates", "", md_table(["source", "status", "bytes", "keys / head"], [[k, v.get("status") or v.get("error"), v.get("bytes"), json.dumps(v.get("daily_keys") or v.get("keys") or v.get("head") or "", ensure_ascii=False)[:200]] for k, v in cov.items()]), ""]

    return "\n".join(lines)

def _r_10(rec, findings, started):
    lines = []
    od = _section(findings, "open_data", {})
    if od:
        lines += ["## 9. Open-data portals", ""]
        for k, v in od.items():
            lines += [f"### {k} — status {v.get('status') or v.get('error')} ({v.get('bytes')} B) {v.get('title') or ''}", ""]
            if v.get("datasets"):
                lines += [f"CKAN count: {v.get('count')}", "", md_table(["dataset", "modified", "resources (name · format · last_modified)"], [[d["title"], d["modified"], "<br>".join(f"{r['name']} · {r['format']} · {r['last_modified']}" for r in d["resources"]) ] for d in v["datasets"]]), ""]
            if v.get("file_links"):
                lines += ["File links:", ""] + [f"- {u}" for u in v["file_links"]] + [""]

    return "\n".join(lines)

def _r_11(rec, findings, started):
    lines = []
    mir = _section(findings, "mirrors", {})
    if mir:
        lines += ["## 10. Community mirrors", "", md_table(["mirror", "status", "bytes"], [[k, v.get("status") or v.get("error"), v.get("bytes")] for k, v in mir.items()]), ""]

    return "\n".join(lines)

def _r_13(rec, findings, started):
    lines = []
    errors = [r for r in rec.log if r.get("error") or (isinstance(r.get("status"), int) and r["status"] >= 400)]
    lines += ["## 11. Failures and skips", "", md_table(["key", "status", "error"], [[r.get("key"), r.get("status"), r.get("error")] for r in errors]) if errors else "None.", ""]



    return "\n".join(lines)

def _r_failures(rec, findings, started):
    lines = []
    errs = [f"- **{k}**: {v.get('section_error')}" for k, v in findings.items() if isinstance(v, dict) and "section_error" in v]
    lines += ["## Section errors", ""] + (errs or ["None."]) + [""]
    return "\n".join(lines)


REPORT_SECTIONS = [("header", _r_header)] + [("1. Every request", _r_1), ("2. robots.txt verdicts", _r_2), ("3. TLS", _r_4), ("4. CELEC ORDS", _r_5), ("5. CELEC dashboards (Angular bundles)", _r_6), ("6. CENACE SMEC daily balance", _r_7), ("7. CENACE Información Operativa", _r_8), ("8. Covariates", _r_9), ("9. Open-data portals", _r_10), ("10. Community mirrors", _r_11), ("11. Failures and skips", _r_13), ("section errors", _r_failures)]


SECTIONS = {
    "tls": section_tls,
    "ords": section_ords,
    "celec_web": section_celec_web,
    "smec": section_smec,
    "operativa": section_operativa,
    "covariates": section_covariates,
    "mirrors": section_mirrors,
    "open_data": section_open_data,
}


def main() -> int:
    ap = argparse.ArgumentParser(description="hydro-look Phase 0 reconnaissance")
    ap.add_argument("--fixtures", default=str(ROOT / "tests" / "fixtures"))
    ap.add_argument("--capture", default=str(ROOT / "recon-capture"), help="directory for every raw response (not committed)")
    ap.add_argument("--report", default=str(ROOT / "scripts" / "recon" / "RECON_REPORT.md"))
    ap.add_argument("--only", default="", help="comma-separated subset of: " + ",".join(SECTIONS))
    ap.add_argument("--ignore-robots", action="store_true", help="not used in CI; for local debugging only")
    args = ap.parse_args()

    started = dt.datetime.now(dt.timezone.utc)
    rec = Recorder(Path(args.fixtures), Path(args.capture), respect_robots=not args.ignore_robots)
    wanted = [s.strip() for s in args.only.split(",") if s.strip()] or list(SECTIONS)
    findings: dict = {"started_utc": started.isoformat(timespec="seconds"), "sections": wanted}
    for name in wanted:
        print(f"===== {name}", flush=True)
        try:
            findings[name] = SECTIONS[name](rec)
        except Exception as error:  # noqa: BLE001
            findings[name] = {"section_error": f"{type(error).__name__}: {error}"[:400]}
            print(f"[section error] {name}: {error}", flush=True)
    recon_dir = Path(args.fixtures) / "recon"
    recon_dir.mkdir(parents=True, exist_ok=True)
    (recon_dir / "capture_log.json").write_text(json.dumps(rec.log, indent=1, ensure_ascii=False), encoding="utf-8")
    (recon_dir / "findings.json").write_text(json.dumps(findings, indent=1, ensure_ascii=False, default=str), encoding="utf-8")
    write_report(Path(args.report), rec, findings, started)
    print(f"report → {args.report}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
