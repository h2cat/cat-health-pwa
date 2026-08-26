// ==========================================================================
// 初期データ（このファイルを直接テキストで編集してOK）
//
// アプリ起動のたびに読み込まれ、「まだ登録されていないコード」だけが
// 自動で追加されます。すでにアプリ内で編集・削除したデータは上書きされません。
// なので、思いついた時にどんどん追記していく使い方ができます。
//
// 注意:
// - codeMaster の code: '' の行は「大分類名称」を表す特別な行です（削除しないこと）
// - foodMaster.formCode / typeCode / makerCode は codeMaster (FOOD_FORM / FOOD_TYPE / MAKER) の code を指定します
// - medicineMaster.unitCode / effectCode は codeMaster (MED_UNIT / MED_EFFECT) の code を指定します
// - medicineMaster.kindFlag は 'DRUG'（薬）か 'SUPPLEMENT'（サプリ）のどちらかを指定します
// - recipeMaster.components は foodMaster の code と比率(ratio)の組み合わせです（例: 餌A:餌B = 6:4）
// - うんち・ゲロの状態、日々のイベントは複数選択できます（それぞれ stateCodes / events が配列）
// - foodMaster / recipeMaster / medicineMaster の abbr は猫タブのログ表示用の略称です（任意、未設定なら名称を表示）
// ==========================================================================

// ----- コードマスタ -----
export const initialCodeMaster = [
  // 餌の形態
  { category: 'FOOD_FORM', code: '', name: '餌の形態' },
  { category: 'FOOD_FORM', code: 'DRY', name: 'ドライ' },
  { category: 'FOOD_FORM', code: 'WET', name: 'ウェット' },
  { category: 'FOOD_FORM', code: 'LIQUID', name: 'リキッド' },
  { category: 'FOOD_FORM', code: 'LIQUID_TREAT', name: 'ちゅーる系' },
  { category: 'FOOD_FORM', code: 'TREAT', name: 'トリーツ' },

  // 餌の種類
  { category: 'FOOD_TYPE', code: '', name: '餌の種類' },
  { category: 'FOOD_TYPE', code: 'RENAL_THERAPY', name: '腎臓療法食' },
  { category: 'FOOD_TYPE', code: 'RENAL_CARE', name: '腎臓に配慮' },
  { category: 'FOOD_TYPE', code: 'OTHER_THERAPY', name: 'その他療法食' },
  { category: 'FOOD_TYPE', code: 'GENERAL_NUTRITION', name: '総合栄養食' },
  { category: 'FOOD_TYPE', code: 'GENERAL_FOOD', name: '一般食' },

  // メーカー（下に直接追記していってOK。例: { category: 'MAKER', code: 'ROYAL_CANIN', name: 'ロイヤルカナン' },）
  { category: 'MAKER', code: '', name: 'メーカー' },
  { category: 'MAKER', code: 'ROYAL_CANIN', name: 'ロイヤルカナン' },
  { category: 'MAKER', code: 'HILLS', name: 'ヒルズ' },
  { category: 'MAKER', code: 'PURINA', name: 'ピュリナ' },
  { category: 'MAKER', code: 'DRS_CARE', name: 'ドクターズケア' },
  { category: 'MAKER', code: 'HAVEST', name: 'HAVEST(病院専用)' },
  { category: 'MAKER', code: 'INABA', name: 'いなば' },
  { category: 'MAKER', code: 'AIXIA', name: 'AIXIA' },
  { category: 'MAKER', code: 'UNKNOWN', name: '不明' },
  { category: 'MAKER', code: 'OTHER', name: 'その他' },

  // うんちの状態（自由に言葉や項目を追加・変更してOK）
  { category: 'STOOL_STATE', code: '', name: 'うんちの状態' },
  { category: 'STOOL_STATE', code: 'NORMAL', name: '正常' },
  { category: 'STOOL_STATE', code: 'SOFT', name: '軟便' },
  { category: 'STOOL_STATE', code: 'DIARRHEA', name: '下痢' },
  { category: 'STOOL_STATE', code: 'HARD', name: '硬め' },
  { category: 'STOOL_STATE', code: 'BLOODY', name: '血便' },
  { category: 'STOOL_STATE', code: 'SMALL', name: '少量' },

  // ゲロの状態（自由に言葉や項目を追加・変更してOK）
  { category: 'VOMIT_STATE', code: '', name: 'ゲロの状態' },
  { category: 'VOMIT_STATE', code: 'UNDIGESTED', name: '未消化物あり' },
  { category: 'VOMIT_STATE', code: 'DIGESTED', name: '消化済み' },
  { category: 'VOMIT_STATE', code: 'FOAM', name: '泡・胃液のみ' },
  { category: 'VOMIT_STATE', code: 'HAIRBALL', name: '毛玉' },
  { category: 'VOMIT_STATE', code: 'BLOODY', name: '血が混じる' },

  // 薬・サプリの単位（下に直接追記していってOK）
  { category: 'MED_UNIT', code: '', name: '単位' },
  { category: 'MED_UNIT', code: 'TABLET', name: '錠' },
  { category: 'MED_UNIT', code: 'ML', name: 'ml' },
  { category: 'MED_UNIT', code: 'MG', name: 'mg' },
  { category: 'MED_UNIT', code: 'DROP', name: '滴' },
  { category: 'MED_UNIT', code: 'G', name: 'g' },
  { category: 'MED_UNIT', code: 'SHOT', name: '💉' },

  // 薬・サプリの効能（下に直接追記していってOK。例: { category: 'MED_EFFECT', code: 'ANTI_EMETIC', name: '吐き気止め' },）
  { category: 'MED_EFFECT', code: '', name: '効能' },
  { category: 'MED_EFFECT', code: 'ANTI_EMETIC', name: '制吐' },
  { category: 'MED_EFFECT', code: 'APPETITE_STIMULATION', name: '食欲増進' },
  { category: 'MED_EFFECT', code: 'ANTI_DIARRHEAL', name: '下痢止め' },
  { category: 'MED_EFFECT', code: 'ANTI_INFLAMMATORY', name: '抗炎症作用' },

  // 日々のイベント（日々管理でチェックを付けられる項目。下に直接追記していってOK）
  { category: 'DAILY_EVENT', code: '', name: '日々のイベント' },
  { category: 'DAILY_EVENT', code: 'HOSPITAL', name: '通院' },

  // メモカテゴリ（メモ入力でチェックを付けられるタグ。略称に絵文字を入れると一覧・カレンダーの絞り込みに使われる。下に直接追記していってOK）
  { category: 'MEMO_CATEGORY', code: '', name: 'メモカテゴリ' },
  { category: 'MEMO_CATEGORY', code: 'MEMO', name: 'メモ', abbr: '📝' },
  { category: 'MEMO_CATEGORY', code: 'COUGH', name: 'せき', abbr: '😷' },
  { category: 'MEMO_CATEGORY', code: 'DANGER', name: '異常事態', abbr: '⚠' },
];

// ----- 猫マスタ -----
// 例: { code: 'CAT01', name: 'クロ', birthDate: '2020-04-01', sex: 'オス', memo: '腎臓療養中' },
export const initialCatMaster = [
  { code: 'DEVICO', name: 'でびこ', birthDate: '2010-09-25', sex: 'メス', memo: '腎臓療養中' },
  { code: 'URICO', name: 'うりこ', birthDate: '2012-05-25', sex: 'メス', memo: '腎臓療養中' }
];

// ----- 餌マスタ -----
// 例: { code: 'F001', maker: 'メーカー名', name: '商品名', abbr: '略称', caloriePer100g: 350, formCode: 'DRY', typeCode: 'RENAL_THERAPY', defaultAmountG: 40 ,memo: ''},
export const initialFoodMaster = [
  { code: 'SELECT_DUCK_DRY', makerCode: 'ROYAL_CANIN', name: 'セレクトプロテインダック&ライス', abbr: 'セレプロD', caloriePer100g: 349, formCode: 'DRY', typeCode: 'OTHER_THERAPY',defaultAmountG :5 },
  { code: 'SELECT_CHICKEN_WET', makerCode: 'ROYAL_CANIN', name: 'セレクトプロテインチキン&ライス', abbr: 'セレプロW', caloriePer100g: 103, formCode: 'WET', typeCode: 'OTHER_THERAPY' ,defaultAmountG :5},
  { code: 'DIGESTIVE_SUPPORT_D', makerCode: 'ROYAL_CANIN', name: '消化器サポートD', abbr: '消化器サポD', caloriePer100g: 390, formCode: 'DRY', typeCode: 'OTHER_THERAPY' ,defaultAmountG :5},
  { code: 'DIGESTIVE_SUPPORT_W', makerCode: 'ROYAL_CANIN', name: '消化器サポートW', abbr: '消化器サポW', caloriePer100g: 77, formCode: 'WET', typeCode: 'OTHER_THERAPY' ,defaultAmountG :5},
  { code: 'RC_EARLY_RENAL_D', makerCode: 'ROYAL_CANIN', name: 'RC早期腎臓サポートドライ', abbr: 'RC早腎サD', caloriePer100g: 381, formCode: 'DRY', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5},
  { code: 'RC_EARLY_RENAL_W', makerCode: 'ROYAL_CANIN', name: 'RC早期腎臓サポートウェット', abbr: 'RC早腎サW', caloriePer100g: 104, formCode: 'WET', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5},
  { code: 'RC_RENAL_FISH_W', makerCode: 'ROYAL_CANIN', name: 'RC腎サポフィッシュW', abbr: 'RC腎魚W', caloriePer100g: 102, formCode: 'WET', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5},
  { code: 'RENAL_LIQUID', makerCode: 'ROYAL_CANIN', name: '腎臓サポートリキッド', abbr: '腎リキッド', caloriePer100g: 108, formCode: 'LIQUID', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5},

  { code: 'STOMACH_CARE', makerCode: 'DRS_CARE', name: 'ストマックケア', abbr: 'ストケア', caloriePer100g: 350, formCode: 'DRY', typeCode: 'OTHER_THERAPY',defaultAmountG :5 },
  { code: 'DRS_FISH_W', makerCode: 'DRS_CARE', name: 'ドクターズケアキドニーケアフィッシュW', abbr: 'Drs魚W', caloriePer100g: 128, formCode: 'WET', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5, memo:'パウチ'},
  { code: 'DRS_CHICKEN_W', makerCode: 'DRS_CARE', name: 'ドクターズケアキドニーケアチキンW', abbr: 'Drs鶏W', caloriePer100g: 131, formCode: 'WET', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5, memo:'パウチ'},
  { code: 'DRS_FISH_D', makerCode: 'DRS_CARE', name: 'ドクターズケアキドニーケアフィッシュD', abbr: 'Drs魚D', caloriePer100g: 425, formCode: 'DRY', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5},

  { code: 'BIOME', makerCode: 'HILLS', name: '腸内バイオーム', abbr: '腸バイオ', caloriePer100g: 377, formCode: 'DRY', typeCode: 'OTHER_THERAPY' ,defaultAmountG :5},
  { code: 'ID_WET', makerCode: 'HILLS', name: 'i/d W', abbr: 'i/d W', caloriePer100g: 113 , formCode: 'WET', typeCode: 'OTHER_THERAPY' ,defaultAmountG :5},
  { code: 'HLS_EARLY_RENAL', makerCode: 'HILLS', name: 'KD早期アシストドライ', abbr: 'KD早腎D', caloriePer100g: 420, formCode: 'DRY', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5},
  { code: 'HLS_RENAL_SALMON_W', makerCode: 'HILLS', name: '腎臓ケアサーモンW', abbr: '腎鮭W', caloriePer100g: 98, formCode: 'WET', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5, memo:'パウチ'},
  { code: 'HLS_RENAL_CHICKEN_W', makerCode: 'HILLS', name: '腎臓ケアチキンW', abbr: '腎鶏W', caloriePer100g: 89, formCode: 'WET', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5 , memo:'パウチ'},
  { code: 'GUT_HEALTH_SUPPORT', makerCode: 'HILLS', name: '腸の健康サポート', abbr: '腸健康', caloriePer100g: 87, formCode: 'WET', typeCode: 'GENERAL_NUTRITION' ,defaultAmountG :5, memo:'パウチ'},
  { code: 'HLS_TUNA_STEW_W', makerCode: 'HILLS', name: 'ツナシチュー', abbr: 'ツナシチュー', caloriePer100g: 95, formCode: 'WET', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5, memo:''},
  { code: 'HLS_CHICKEN_STEW_W', makerCode: 'HILLS', name: '鶏シチュー缶', abbr: '鶏シチュー缶', caloriePer100g: 87, formCode: 'WET', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5, memo:''},
  { code: 'HLS_TUNA_W', makerCode: 'HILLS', name: 'ツナ缶', abbr: 'ツナ缶', caloriePer100g: 112, formCode: 'WET', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5, memo:''},
  { code: 'HLS_CHICKEN_W', makerCode: 'HILLS', name: '鶏缶', abbr: '鶏缶', caloriePer100g: 117, formCode: 'WET', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5, memo:''},

  { code: 'PURINA_RENAL_W', makerCode: 'PURINA', name: 'ピュリナ腎臓ケアW', abbr: 'P腎W', caloriePer100g: 105, formCode: 'WET', typeCode: 'RENAL_THERAPY' ,defaultAmountG :5},
  { code: 'PURINA_HYDRA', makerCode: 'PURINA', name: 'ハイドラケア', abbr: 'ハイドラケア', caloriePer100g: 22, formCode: 'LIQUID', typeCode: 'GENERAL_FOOD' ,defaultAmountG :75},
  { code: 'LOWFAT_LIQUID', makerCode: 'HAVEST', name: '低脂肪リキッド', abbr: '低脂肪リキッド', caloriePer100g: 110 , formCode: 'LIQUID', typeCode: 'OTHER_THERAPY',defaultAmountG :20},
  { code: 'QUESTION_WET50', makerCode: 'UNKNOWN', name: '謎ウェット50', abbr: '謎W50', caloriePer100g: 50, formCode: 'WET', typeCode: 'GENERAL_FOOD' ,defaultAmountG :5},
  { code: 'QUESTION_WET60', makerCode: 'UNKNOWN', name: '謎ウェット60', abbr: '謎W60', caloriePer100g: 60, formCode: 'WET', typeCode: 'GENERAL_FOOD' ,defaultAmountG :5},
  { code: 'QUESTION_WET90', makerCode: 'UNKNOWN', name: '謎ウェット90', abbr: '謎W90', caloriePer100g: 90, formCode: 'WET', typeCode: 'GENERAL_FOOD' ,defaultAmountG :5},
  { code: 'ENERGY_TULE', makerCode: 'INABA', name: '腎臓エネルギーチュール', abbr: '腎臓エネちゅーる', caloriePer100g: 100 , formCode: 'LIQUID_TREAT', typeCode: 'RENAL_THERAPY',defaultAmountG :14},
  { code: 'AIM_TREATS', makerCode: 'OTHER', name: 'AIMおやつ', abbr: 'AIMおやつ', caloriePer100g: 384 , formCode: 'TREAT', typeCode: 'TREAT',defaultAmountG :5},
  { code: 'MEDI_MOUSE', makerCode: 'OTHER', name: '腎臓メディムース', abbr: '腎臓メディムース', caloriePer100g: 53 , formCode: 'WET', typeCode: 'RENAL_CARE',defaultAmountG :5},
  { code: 'ICARE_WATER_TUNA', makerCode: 'AIXIA', name: 'iCare水分補給マグロ', abbr: 'iCare水分補給マグロ', caloriePer100g: 46 , formCode: 'LIQUID', typeCode: 'GENERAL_FOOD',defaultAmountG :35},
  { code: 'ICARE_WATER_BONITO', makerCode: 'AIXIA', name: 'iCare水分補給カツオ', abbr: 'iCare水分補給カツオ', caloriePer100g: 46 , formCode: 'LIQUID', typeCode: 'GENERAL_FOOD',defaultAmountG :35},
  { code: 'ICARE_RENAL_TUNA', makerCode: 'AIXIA', name: 'iCare腎マグロ', abbr: 'iCare腎マグロ', caloriePer100g: 51 , formCode: 'LIQUID', typeCode: 'RENAL_CARE',defaultAmountG :35},
  { code: 'ICARE_RENAL_BONITO', makerCode: 'AIXIA', name: 'iCare腎カツオ', abbr: 'iCare腎カツオ', caloriePer100g: 51 , formCode: 'LIQUID', typeCode: 'RENAL_CARE',defaultAmountG :35},
  { code: 'AIXIA_RENAL_TUNA', makerCode: 'AIXIA', name: 'AIXIA腎マグロ', abbr: 'AIXIA腎マグロ', caloriePer100g: 98 , formCode: 'WET', typeCode: 'RENAL_CARE',defaultAmountG :35},

  { code: 'KITCAT_GOAT_MILK', makerCode: 'OTHER', name: 'キットキャットゴートミルク', abbr: 'キットキャットゴートミルク', caloriePer100g: 54 , formCode: 'WET', typeCode: 'GENERAL_FOOD',defaultAmountG :5},
  { code: 'KITCAT_MOUSE', makerCode: 'OTHER', name: 'キットキャットムース', abbr: 'キットキャットムース', caloriePer100g: 101 , formCode: 'WET', typeCode: 'GENERAL_FOOD',defaultAmountG :5},

];

// ----- サプリ・投薬マスタ -----
// 例: { code: 'M001', name: 'セレニア', abbr: 'セレニア', kindFlag: 'DRUG', defaultDose: 1, unitCode: 'TABLET', effectCode: 'ANTI_EMETIC', memo: '朝晩' },
export const initialMedicineMaster = [
  { code: 'CERENIA', name: 'セレニア', kindFlag: 'DRUG', defaultDose: 6, unitCode: 'MG', effectCode: 'ANTI_EMETIC', memo: '1日1回or頓服6～8mg' },
  { code: 'CERENIA_SHOT', name: 'セレニア注射', kindFlag: 'DRUG', defaultDose: 1, unitCode: 'SHOT', effectCode: 'ANTI_EMETIC', memo: '1日1回or頓服' },
  { code: 'REMERON', name: 'レメロン', kindFlag: 'DRUG', defaultDose: 1.8, unitCode: 'MG', effectCode: 'APPETITE_STIMULATION', memo: '3日に1回or頓服' },
  { code: 'DIABUSTER', name: 'ディアバスター', kindFlag: 'DRUG', defaultDose: 1, unitCode: 'TABLET', effectCode: 'ANTI_DIARRHEAL', memo: '1日に2回or頓服' },
  { code: 'PRONAMIDE', name: 'プロナミド', abbr: 'プロナミド', kindFlag: 'DRUG', defaultDose: 0.5, unitCode: 'TABLET', effectCode: 'ANTI_EMETIC', memo: '1日2回 1/2錠（カレンダー記載の「プロアミド」は同一薬の表記ゆれ）' },
  { code: 'RINGERS', name: '点滴', abbr: '点滴', kindFlag: 'DRUG', defaultDose: 200, unitCode: 'ML', effectCode: 'ANTI_EMETIC', memo: 'リンゲル液' },
  { code: 'MOEGI_OIL', name: 'モエギオイル25mg', abbr: 'モエギオイル', kindFlag: 'SUPPLEMENT', defaultDose: 1, unitCode: 'TABLET', effectCode: 'ANTI_INFLAMMATORY', memo: 'DHCのやつ' },
];

// ----- レシピマスタ（複数の餌を混ぜて与える場合のみ登録。単一の餌はそのまま餌マスタから選べます） -----
// 例: { code: 'R001', name: 'いつものブレンド', components: [{ foodCode: 'F001', ratio: 6 }, { foodCode: 'F002', ratio: 4 }], defaultAmountG: 5,memo: '' },
export const initialRecipeMaster = [
   { code: 'RC_EARLY_RENAL_BIOME', name: '早腎サ腸バイオ', components: [{ foodCode: 'BIOME', ratio: 5 }, { foodCode: 'RC_EARLY_RENAL_D', ratio: 5 }], defaultAmountG: 5 ,memo: '' },
   { code: 'RC_HLS_EARLY_RENAL', name: '早腎KD', components: [{ foodCode: 'HLS_EARLY_RENAL', ratio: 5 }, { foodCode: 'RC_EARLY_RENAL_D', ratio: 5 }], defaultAmountG: 5 ,memo: '' },
   { code: 'DIGESTIVE_SUPPORT_LIQUID', name: '消化器リキッド', components: [{ foodCode: 'DIGESTIVE_SUPPORT_W', ratio: 6 }, { foodCode: 'RENAL_LIQUID', ratio: 4 }], defaultAmountG: 5 ,memo: '' },
   { code: 'SELECT_CHICKEN_LIQUID', name: 'セレプロリキッド', components: [{ foodCode: 'SELECT_CHICKEN_WET', ratio: 6 }, { foodCode: 'RENAL_LIQUID', ratio: 4 }], defaultAmountG: 5 ,memo: '' },
   { code: 'KITCAT_GUT_HEALTH_SUPPORT', name: 'キットキャット腸健康MIX', components: [{ foodCode: 'KITCAT_MOUSE', ratio: 5 }, { foodCode: 'GUT_HEALTH_SUPPORT', ratio: 5 }], defaultAmountG: 5 ,memo: '' },
];
