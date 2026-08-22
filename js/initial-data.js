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

  // 日々のイベント（日々管理でチェックを付けられる項目。下に直接追記していってOK）
  { category: 'DAILY_EVENT', code: '', name: '日々のイベント' },
  { category: 'DAILY_EVENT', code: 'HOSPITAL', name: '通院' }
];

// ----- 猫マスタ -----
// 例: { code: 'CAT01', name: 'クロ', birthDate: '2020-04-01', sex: 'オス', memo: '腎臓療養中' },
export const initialCatMaster = [
  { code: 'DEVICO', name: 'でびこ', birthDate: '2010-09-25', sex: 'メス', memo: '腎臓療養中' },
  { code: 'URICO', name: 'うりこ', birthDate: '2012-05-25', sex: 'メス', memo: '腎臓療養中' }
];

// ----- 餌マスタ -----
// 例: { code: 'F001', maker: 'メーカー名', name: '商品名', abbr: '略称', caloriePer100g: 350, formCode: 'DRY', typeCode: 'RENAL_THERAPY', defaultAmountG: 40 },
export const initialFoodMaster = [
  { code: 'SELECT_DUCK_DRY', makerCode: 'ROYAL_CANIN', name: 'セレクトプロテインダック&ライス', abbr: 'セレクトプロテイン', caloriePer100g: 349, formCode: 'DRY', typeCode: 'OTHER_THERAPY' },
  { code: 'SELECT_CHICKEN_WET', makerCode: 'ROYAL_CANIN', name: 'セレクトプロテインチキン&ライス', abbr: 'セレクトプロテイン', caloriePer100g: 103, formCode: 'WET', typeCode: 'OTHER_THERAPY' },
];

// ----- サプリ・投薬マスタ -----
// 例: { code: 'M001', name: 'セレニア', abbr: 'セレニア', kindFlag: 'DRUG', defaultDose: 1, unitCode: 'TABLET', effectCode: 'ANTI_EMETIC', memo: '朝晩' },
export const initialMedicineMaster = [
  { code: 'CERENIA', name: 'セレニア', kindFlag: 'DRUG', defaultDose: 1, unitCode: 'TABLET', effectCode: 'ANTI_EMETIC', memo: '1日1回or頓服' },
  { code: 'CERENIA_SHOT', name: 'セレニア注射', kindFlag: 'DRUG', defaultDose: 1, unitCode: 'SHOT', effectCode: 'ANTI_EMETIC', memo: '1日1回or頓服' },
  { code: 'REMERON', name: 'レメロン', kindFlag: 'DRUG', defaultDose: 1, unitCode: 'TABLET', effectCode: 'APPETITE_STIMULATION', memo: '3日に1回or頓服' },
  { code: 'DIABUSTER', name: 'ディアバスター', kindFlag: 'DRUG', defaultDose: 1, unitCode: 'TABLET', effectCode: 'ANTI_DIARRHEAL', memo: '1日に2回or頓服' },
];

// ----- レシピマスタ（複数の餌を混ぜて与える場合のみ登録。単一の餌はそのまま餌マスタから選べます） -----
// 例: { code: 'R001', name: 'いつものブレンド', components: [{ foodCode: 'F001', ratio: 6 }, { foodCode: 'F002', ratio: 4 }], memo: '' },
export const initialRecipeMaster = [
];
