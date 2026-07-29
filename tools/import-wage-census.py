# -*- coding: utf-8 -*-
# 賃金構造基本統計調査（職種・小分類 第1表）→ tools/data/salary.json
# 実行: python tools/import-wage-census.py
#
# 入力: tools/data/src/wage-census-r7-occ1.xlsx
#   = 厚生労働省「令和7年賃金構造基本統計調査」（職種）第1表
#     「職種（小分類）、性別きまって支給する現金給与額、所定内給与額及び年間賞与その他特別給与額（産業計）」
#     e-Stat: https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040421116&fileKind=4
#     （公表 2026-03-24 / 政府統計の総合窓口(e-Stat) / 利用は政府標準利用規約に従う）
#
# 方針（ファクトポリシー）:
#   - 男女計・企業規模計(10人以上)の値のみ採用。数値の改変はしない
#   - 年収（averageSalary, 万円）は「きまって支給する現金給与額×12＋年間賞与その他特別給与額」で算出し、
#     算出式をデータの note に必ず持たせる（サイト側で常時表示）
#   - 当サイト職種(slug)への対応付けは、統計区分が職種の中核を妥当にカバーする場合のみ。
#     ページには必ず統計上の区分名（label）を表示し、対応の透明性を保つ
#   - 対応不能な区分もラベル付きで /salary/ の一覧に掲載する（データを絞らない）
import zipfile, re, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tools", "data", "src", "wage-census-r7-occ1.xlsx")
OUT = os.path.join(ROOT, "tools", "data", "salary.json")

SOURCE = {
    "sourceName": "厚生労働省「令和7年賃金構造基本統計調査」（職種）第1表（産業計・男女計・企業規模計）",
    "sourceUrl": "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040421116&fileKind=4",
    "sourceDate": "2026-03-24",
    "period": "令和7年（2025年）調査",
    "note": "年収は「きまって支給する現金給与額×12＋年間賞与その他特別給与額」による算出値（一般労働者）。",
}

# 統計区分 → 当サイト職種slug（中核が一致する場合のみ。区分名は必ず併記表示される）
NAME_MAP = {
    "研究者": ["uchujuku-kenkyu"],
    "電気・電子・電気通信技術者（通信ネットワーク技術者を除く）": ["denki-sekkei"],
    "機械技術者": ["kikai-sekkei"],
    "建築技術者": ["sekou-kanri-kenchiku", "kenchiku-sekkei"],
    "土木技術者": ["sekou-kanri-doboku"],
    "測量技術者": ["sokuryo"],
    "システムコンサルタント・設計者": ["system-engineer", "it-consultant"],
    "ソフトウェア作成者": ["engineer", "backend-engineer", "frontend-engineer"],
    "医師": ["doctor"],
    "歯科医師": ["dentist"],
    "薬剤師": ["pharmacist"],
    "保健師": ["public-health-nurse"],
    "助産師": ["midwife"],
    "看護師": ["nurse", "kango-shien"],
    "診療放射線技師": ["radiological-technologist"],
    "臨床検査技師": ["clinical-technologist"],
    "歯科衛生士": ["dental-hygienist"],
    "栄養士": ["nutritionist"],
    "保育士": ["hoikushi"],
    "介護支援専門員（ケアマネージャー）": ["caremanager"],
    "法務従事者": ["bengoshi"],
    "公認会計士，税理士": ["konin-kaikeishi", "zeirishi"],
    "幼稚園教員，保育教諭": ["kindergarten-teacher"],
    "小・中学校教員": ["elementary-teacher"],
    "高等学校教員": ["highschool-teacher"],
    "個人教師": ["yobiko-tutor", "juku-teacher"],
    "著述家，記者，編集者": ["writer", "editor"],
    "美術家，写真家，映像撮影者": ["photographer", "videographer"],
    "デザイナー": ["graphic-designer"],
    "庶務・人事事務員": ["shiharai-shomu", "hr-labor"],
    "企画事務員": ["kikaku-assistant"],
    "受付・案内事務員": ["receptionist"],
    "秘書": ["secretary"],
    "電話応接事務員": ["call-center"],
    "総合事務員": ["office-admin"],
    "会計事務従事者": ["accounting-clerk", "accounting"],
    "営業・販売事務従事者": ["sales-admin"],
    "運輸・郵便事務従事者": ["logistics-admin"],
    "事務用機器操作員": ["data-entry"],
    "販売店員": ["retail-sales"],
    "自動車営業職業従事者": ["car-sales"],
    "機械器具・通信・システム営業職業従事者（自動車を除く）": ["it-sales", "machinery-sales", "telecom-sales"],
    "金融営業職業従事者": ["securities-sales", "bank-sales"],
    "保険営業職業従事者": ["insurance-sales"],
    "その他の営業職業従事者": ["sales", "kojin-eigyo", "route-sales"],
    "介護職員（医療・福祉施設等）": ["care-worker", "day-service-staff"],
    "訪問介護従事者": ["home-helper"],
    "看護助手": ["nurse-assistant"],
    "理容・美容師": ["beauty", "hairstylist", "barber"],
    "美容サービス・浴場従事者（美容師を除く）": ["esthetician", "nail-artist"],
    "クリーニング職，洗張職": ["linen-supply"],
    "飲食物調理従事者": ["food-service", "cook-staff", "chef", "nursery-cook"],
    "飲食物給仕従事者": ["hall-staff", "banquet-staff"],
    "航空機客室乗務員": ["airline-crew"],
    "身の回り世話従事者": ["housekeeping", "childcare-sitter"],
    "娯楽場等接客員": ["amusement-staff", "pachinko-staff"],
    "居住施設・ビル等管理人": ["mansion-frontman"],
    "警備員": ["security-guard"],
    "農林漁業従事者": ["nogyo"],
    "金属工作機械作業従事者": ["cnc-operator"],
    "金属溶接・溶断従事者": ["yousetsu"],
    "食料品・飲料・たばこ製造従事者": ["food-factory"],
    "印刷・製本従事者": ["insatsu-operator"],
    "はん用・生産用・業務用機械器具組立従事者": ["kumitate", "seizo-operator"],
    "自動車組立従事者": ["manufacturing"],
    "自動車整備・修理従事者": ["car-mechanic-service"],
    "製品検査従事者（金属製品を除く）": ["kensa-in"],
    "画工，塗装・看板制作従事者": ["gaiheki-tosou"],
    "鉄道運転従事者": ["train-driver"],
    "車掌": ["station-staff"],
    "バス運転者": ["bus-driver"],
    "タクシー運転者": ["taxi-driver"],
    "営業用大型貨物自動車運転者": ["untenshi-truck"],
    "営業用貨物自動車運転者（大型車を除く）": ["driver", "haisou-route"],
    "航空機操縦士": ["pilot"],
    "クレーン・ウインチ運転従事者": ["untenshi-crane"],
    "建設・さく井機械運転従事者": ["juki-operator"],
    "建設躯体工事従事者": ["tobi"],
    "大工": ["daiku"],
    "配管従事者": ["haikan-ko"],
    "電気工事従事者": ["denki-koji"],
    "ビル・建物清掃員": ["building-cleaning"],
    "清掃員（ビル・建物を除く），廃棄物処理従事者": ["seiso-driver"],
    "包装従事者": ["housou-sagyo"],
    "その他の運搬従事者": ["warehouse-staff"],
    "宗教家": ["funeral-priest"],
}

def clean(name):
    # ルビ（末尾カタカナ）とセクション接頭辞・前後空白を除去
    name = name.replace("\r\n", "").lstrip("　 ").strip()
    name = re.sub(r"^(男女計|男|女)\s*", "", name)
    name = re.sub(r"[ァ-ヶー]+$", "", name)
    return name.strip()

def main():
    z = zipfile.ZipFile(SRC)
    ss = z.read("xl/sharedStrings.xml").decode("utf-8")
    strs = [re.sub(r"<[^>]+>", "", m) for m in re.findall(r"<si>(.*?)</si>", ss, re.S)]
    sh = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
    rows = re.findall(r'<row[^>]*r="(\d+)"[^>]*>(.*?)</row>', sh, re.S)

    title = ""
    section = None
    out = []
    slug_seen = set()
    for r, x in rows:
        cells = {}
        for m in re.finditer(r"<c ([^>]*)>(?:<v>([^<]*)</v>)?(?:</c>)?", x):
            attrs, v = m.group(1), m.group(2)
            if v is None:
                continue
            col = re.search(r'r="([A-Z]+)\d+"', attrs).group(1)
            cells[col] = strs[int(v)] if re.search(r't="s"', attrs) else v
        if r == "2":
            title = cells.get("D", "")
        b = cells.get("B", "")
        if not b:
            continue
        nb = b.replace("\r\n", "").lstrip("　 ").strip()
        if "男女計" in nb:
            section = "all"
        elif nb.startswith("男"):
            section = "m"
        elif nb.startswith("女"):
            section = "f"
        if section != "all":
            continue
        name = clean(b)
        if not name or name in ("区　分", "不詳"):
            continue
        try:
            age = float(cells["D"])
            kimatte = float(cells["H"])   # きまって支給する現金給与額（千円）
            shotei = float(cells["I"])    # 所定内給与額（千円）
            bonus = float(cells["J"])     # 年間賞与その他特別給与額（千円）
            workers = float(cells["K"])   # 労働者数（十人）
        except (KeyError, ValueError):
            continue
        annual_man = round((kimatte * 12 + bonus) / 10)  # 千円→万円
        slugs = NAME_MAP.get(name, [])
        for s in slugs:
            if s in slug_seen:
                raise SystemExit(f"slug {s} が複数区分に対応しています（マッピング重複）: {name}")
            slug_seen.add(s)
        out.append({
            "label": name,
            "occupationSlugs": slugs,
            "ageGroup": "all", "genderGroup": "all",
            "averageSalary": annual_man,            # 万円・年収（算出値）
            "monthlyWage": kimatte,                  # 千円・きまって支給する現金給与額
            "scheduledWage": shotei,                 # 千円・所定内給与額
            "annualBonus": bonus,                    # 千円・年間賞与その他特別給与額
            "averageAge": age,
            "medianSalary": None, "salaryMin": None, "salaryMax": None,
            "sampleCount": int(workers * 10),        # 労働者数（人）
            **SOURCE,
        })
    if "賃金構造基本統計調査" not in title:
        raise SystemExit("入力ファイルのタイトルが想定と異なります: " + title)
    out.sort(key=lambda r: -r["averageSalary"])
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    mapped = sum(1 for r in out if r["occupationSlugs"])
    print(f"OK: {len(out)} 区分 -> salary.json（うち職種ページ紐付け {mapped} 区分 / slug {len(slug_seen)}件）")
    print("次: node tools/seed.mjs → index.html の data.js?v= バンプ → node build.mjs")

if __name__ == "__main__":
    main()
