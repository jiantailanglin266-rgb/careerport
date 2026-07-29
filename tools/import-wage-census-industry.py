# -*- coding: utf-8 -*-
# 賃金構造基本統計調査 → 業界（産業中分類）別 / 都道府県×職業（大分類）別 の年収データ取り込み
# 実行: python tools/import-wage-census-industry.py
# 出力: tools/data/salary-industry.json（group:"industry"） / tools/data/salary-area.json（group:"area"）
#
# データソース（すべて e-Stat・令和7年調査・一般労働者・企業規模計10人以上・民営事業所）:
#  - 産業別: 各「産業中分類 第1表（年齢階級別きまって支給する現金給与額…）」の男女計・学歴計行。
#    ※産業大分類の第1表はxlsx公表が無いため、業界ページには対応する中分類の統計を
#      区分名を明示した上で掲載する（大分類値として偽装しない）。産業計はベンチマークとして掲載。
#  - 都道府県別: 「都道府県別第2表 都道府県、職種（大分類）、性別きまって支給する現金給与額…（産業計）」
#    4分割ファイル（全国＋47都道府県 × 職業大分類）の男女計セクション。
# 方針: 数値の改変・集計・推定はしない。年収（万円）= きまって支給×12 + 年間賞与（算出式は常時表示）。
import zipfile, re, json, os, urllib.request, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", "data", "src", "industry")
UA = {"User-Agent": "Mozilla/5.0 (CAREERPORT data import; contact: jiantailanglin266@gmail.com)"}

SOURCE_BASE = {
    "sourceName": "厚生労働省「令和7年賃金構造基本統計調査」（一般労働者・民営事業所・企業規模計10人以上・男女計）",
    "sourceDate": "2026-03-24",
    "period": "令和7年（2025年）調査",
    "note": "年収は「きまって支給する現金給与額×12＋年間賞与その他特別給与額」による算出値（一般労働者）。",
}

# 産業中分類 第1表: (statInfId, 産業セル検証用の一致文字列, 表示ラベル, 業界slug[])
INDUSTRY_FILES = [
    ("000040420843", "産業計",            "産業計（全産業・ベンチマーク）", []),
    ("000040420846", "総合工事業",        "総合工事業（産業中分類）",       ["construction"]),
    ("000040420847", "食料品製造業",      "食料品製造業（産業中分類）",     ["manufacturing"]),
    ("000040420849", "通信業",            "通信業（産業中分類）",           ["it", "web"]),
    ("000040420850", "鉄道業",            "鉄道業（産業中分類）",           ["logistics"]),
    ("000040420851", "卸売業",            "卸売業（産業中分類）",           ["retail"]),
    ("000040420852", "銀行業",            "銀行業（産業中分類）",           ["finance"]),
    ("000040420853", "不動産取引業",      "不動産取引業（産業中分類）",     ["real-estate"]),
    ("000040420854", "学術・開発研究機関", "学術・開発研究機関（産業中分類）", ["consulting"]),
    ("000040420855", "宿泊業",            "宿泊業（産業中分類）",           ["food"]),
    ("000040420856", "洗濯・理容・美容・浴場業", "洗濯・理容・美容・浴場業（産業中分類）", ["beauty"]),
    ("000040420857", "学校教育",          "学校教育（産業中分類）",         ["education"]),
    ("000040420858", "医療業",            "医療業（産業中分類）",           ["medical", "care"]),
]

# 都道府県別第2表（4分割・全国+47都道府県）
PREF_FILES = ["000040421191", "000040421192", "000040421193", "000040421194"]
PREF_SLUGS = {  # e-Stat の都道府県表記 → 当サイト slug
    "北海道": "hokkaido", "青森": "aomori", "岩手": "iwate", "宮城": "miyagi", "秋田": "akita",
    "山形": "yamagata", "福島": "fukushima", "茨城": "ibaraki", "栃木": "tochigi", "群馬": "gunma",
    "埼玉": "saitama", "千葉": "chiba", "東京": "tokyo", "神奈川": "kanagawa", "新潟": "niigata",
    "富山": "toyama", "石川": "ishikawa", "福井": "fukui", "山梨": "yamanashi", "長野": "nagano",
    "岐阜": "gifu", "静岡": "shizuoka", "愛知": "aichi", "三重": "mie", "滋賀": "shiga",
    "京都": "kyoto", "大阪": "osaka", "兵庫": "hyogo", "奈良": "nara", "和歌山": "wakayama",
    "鳥取": "tottori", "島根": "shimane", "岡山": "okayama", "広島": "hiroshima", "山口": "yamaguchi",
    "徳島": "tokushima", "香川": "kagawa", "愛媛": "ehime", "高知": "kochi", "福岡": "fukuoka",
    "佐賀": "saga", "長崎": "nagasaki", "熊本": "kumamoto", "大分": "oita", "宮崎": "miyazaki",
    "鹿児島": "kagoshima", "沖縄": "okinawa",
}
OCC_MAJOR = ["管理的職業従事者", "専門的・技術的職業従事者", "事務従事者", "販売従事者",
             "サービス職業従事者", "保安職業従事者", "農林漁業従事者", "生産工程従事者",
             "輸送・機械運転従事者", "建設・採掘従事者", "運搬・清掃・包装等従事者"]

def http(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def load_xlsx(sid):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, sid + ".xlsx")
    if not os.path.exists(path):
        data = http("https://www.e-stat.go.jp/stat-search/file-download?statInfId=%s&fileKind=4" % sid)
        with open(path, "wb") as f:
            f.write(data)
        time.sleep(0.6)
    try:
        z = zipfile.ZipFile(path)
        ss = z.read("xl/sharedStrings.xml").decode("utf-8")
        strs = [re.sub(r"<[^>]+>", "", m) for m in re.findall(r"<si>(.*?)</si>", ss, re.S)]
        sh = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
    except Exception:
        return None
    rows = []
    for r, x in re.findall(r'<row[^>]*r="(\d+)"[^>]*>(.*?)</row>', sh, re.S):
        c = {}
        for m in re.finditer(r"<c ([^>]*)>(?:<v>([^<]*)</v>)?(?:</c>)?", x):
            attrs, v = m.group(1), m.group(2)
            if v is None:
                continue
            col = re.search(r'r="([A-Z]+)\d+"', attrs).group(1)
            c[col] = strs[int(v)] if re.search(r't="s"', attrs) else v
        rows.append((int(r), c))
    return rows

def col_index(col):
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n

def col_name(n):
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s

def make_row(label, age, kimatte, shotei, bonus, workers, extra):
    return {
        "label": label, "ageGroup": "all", "genderGroup": "all",
        "averageSalary": round((kimatte * 12 + bonus) / 10),
        "monthlyWage": kimatte, "scheduledWage": shotei, "annualBonus": bonus,
        "averageAge": age, "medianSalary": None, "salaryMin": None, "salaryMax": None,
        "sampleCount": int(workers * 10), **extra, **SOURCE_BASE,
    }

def import_industries():
    out = []
    for sid, match, label, slugs in INDUSTRY_FILES:
        rows = load_xlsx(sid)
        d = dict(rows)
        title = "".join(str(v) for v in d.get(3, {}).values()) + "".join(str(v) for v in d.get(2, {}).values())
        sangyo = str(d.get(7, {}).get("D", "")).replace("　", "")
        assert "第１表" in title.replace("　", "") and match.replace("・", "") in sangyo.replace("・", ""), \
            "%s: 期待した表ではありません (%s / %s)" % (sid, title[:30], sangyo)
        got = None
        for rn, c in rows:
            lbl = str(c.get("C", ""))
            if "男" in lbl and "女" in lbl and "計" in lbl:  # 男女計・学歴計
                got = c
                break
        assert got, sid + ": 男女計行が見つかりません"
        out.append(make_row(label, float(got["D"]), float(got["H"]), float(got["I"]),
                            float(got["J"]), float(got["K"]),
                            {"industrySlugs": slugs, "group": "industry",
                             "sourceUrl": "https://www.e-stat.go.jp/stat-search/file-download?statInfId=%s&fileKind=4" % sid}))
        print("✓ industry:", label, out[-1]["averageSalary"], "万円")
    return out

def import_prefectures():
    out = []
    for sid in PREF_FILES:
        rows = load_xlsx(sid)
        d = dict(rows)
        # row5: 列ブロック先頭 → 都道府県名
        blocks = []
        for col, v in d.get(5, {}).items():
            name = re.sub(r"^[０-９0-9]+", "", str(v).replace("　", ""))
            name = re.sub(r"[ァ-ヶー]+$", "", name).strip()
            if name and name != "区分":
                blocks.append((col_index(col), name))
        blocks.sort()
        # 男女計セクションの職業大分類行（先頭セクションのみ。「男」単独セクションで打ち切り）
        section_rows = []
        in_all = False
        for rn, c in rows:
            lbl = str(c.get("C", c.get("B", ""))).replace("\r\n", "")
            base = re.sub(r"[ァ-ヶー]+$", "", lbl.replace("　", "").replace(" ", ""))
            if "男女計" in base:
                in_all = True
                base = base.replace("男女計", "")
            elif in_all and (base.startswith("男") or base.startswith("女")):
                break
            if in_all:
                name = next((o for o in OCC_MAJOR if base == o.replace("・", "・")), None)
                if name is None:
                    name = next((o for o in OCC_MAJOR if base == o), None)
                if name:
                    section_rows.append((name, c))
        for start, pref in blocks:
            if pref == "全国" or pref not in PREF_SLUGS:
                continue
            slug = PREF_SLUGS[pref]
            for occ, c in section_rows:
                try:
                    age = float(c[col_name(start)]); kimatte = float(c[col_name(start + 4)])
                    shotei = float(c[col_name(start + 5)]); bonus = float(c[col_name(start + 6)])
                    workers = float(c[col_name(start + 7)])
                except (KeyError, ValueError):
                    continue  # 秘匿等で値なしの職業はスキップ（推定で埋めない）
                out.append(make_row("%s／%s（職業大分類）" % (pref, occ), age, kimatte, shotei, bonus, workers,
                                    {"prefSlugs": [slug], "occLabel": occ, "group": "area",
                                     "sourceUrl": "https://www.e-stat.go.jp/stat-search/file-download?statInfId=%s&fileKind=4" % sid}))
    prefs = len(set(r["prefSlugs"][0] for r in out))
    print("✓ area rows:", len(out), "prefectures:", prefs)
    assert prefs == 47, "47都道府県に達していません: %d" % prefs
    return out

def main():
    ind = import_industries()
    ind.sort(key=lambda r: -r["averageSalary"])
    with open(os.path.join(ROOT, "tools", "data", "salary-industry.json"), "w", encoding="utf-8") as f:
        json.dump(ind, f, ensure_ascii=False, indent=1)
    area = import_prefectures()
    with open(os.path.join(ROOT, "tools", "data", "salary-area.json"), "w", encoding="utf-8") as f:
        json.dump(area, f, ensure_ascii=False, indent=1)
    print("OK: industry=%d rows, area=%d rows" % (len(ind), len(area)))
    print("次: node tools/seed.mjs → data.js?v= バンプ → node build.mjs")

if __name__ == "__main__":
    main()
