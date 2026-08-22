// 猫別・日次ログJSON（import/devico.json など）の取り込み処理。
// 「全データ消去→丸ごと置換」の通常インポート（io.js）とは別に、
// 指定した猫×日付の範囲だけを安全に作り直す（他の猫・他の日・マスタには一切触れない）。
import { get, put, remove, getAll, getByIndex } from './db.js';
import { calcCalorie } from './utils.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function applyCatDayLog(data) {
  const catCode = data && data.catCode;
  if (!catCode) throw new Error('catCode が指定されていません');
  const cat = await get('catMaster', catCode);
  if (!cat) throw new Error(`猫マスタに存在しない catCode です: ${catCode}`);

  const allFoods = await getAll('foodMaster');
  const allRecipes = await getAll('recipeMaster');

  const days = (data && data.days) || {};
  const result = { catCode, dates: 0, feeding: 0, medicine: 0, poop: 0, vomit: 0, memos: 0, errors: [] };

  for (const date of Object.keys(days)) {
    if (!DATE_RE.test(date)) {
      result.errors.push(`日付形式が不正なためスキップ: ${date}`);
      continue;
    }
    const day = days[date] || {};
    result.dates++;

    // ---- dailyLog（体重・尿量・イベント・日メモ・無効フラグ）は upsert ----
    const existingDailyRows = await getByIndex('dailyLog', 'byCatDate', [catCode, date]);
    const existingDaily = existingDailyRows[0] || null;
    const hasDailyFields = ['weight', 'urineAmount', 'events', 'memo', 'invalid'].some(k => day[k] !== undefined);
    if (hasDailyFields || existingDaily) {
      const dailyData = {
        catCode,
        date,
        weight: day.weight !== undefined ? day.weight : (existingDaily ? existingDaily.weight : null),
        urineAmount: day.urineAmount !== undefined ? day.urineAmount : (existingDaily ? existingDaily.urineAmount : null),
        events: day.events !== undefined ? day.events : (existingDaily ? existingDaily.events : []),
        memo: day.memo !== undefined ? day.memo : (existingDaily ? existingDaily.memo : ''),
        invalid: day.invalid !== undefined ? !!day.invalid : (existingDaily ? !!existingDaily.invalid : false)
      };
      if (existingDaily) dailyData.id = existingDaily.id;
      await put('dailyLog', dailyData);
    }

    // ---- feedingLog: この日の分を作り直す ----
    if (Array.isArray(day.feeding)) {
      const existingFeed = await getByIndex('feedingLog', 'byCatDate', [catCode, date]);
      for (const row of existingFeed) await remove('feedingLog', row.id);

      for (const f of day.feeding) {
        const sourceType = f.sourceType === 'RECIPE' ? 'RECIPE' : 'FOOD';
        const sourceCode = f.sourceCode;
        const kind = f.kind === 'SERVE' ? 'SERVE' : 'INTAKE';
        const provided = f.providedAmount != null ? Number(f.providedAmount) : null;
        const eaten = f.eatenAmount != null ? Number(f.eatenAmount) : null;

        let breakdown = [];
        let calorie = 0;
        if (kind === 'INTAKE' && eaten != null) {
          if (sourceType === 'FOOD') {
            const food = allFoods.find(x => x.code === sourceCode);
            if (!food) result.errors.push(`${date}: 未登録の餌コード ${sourceCode}`);
            const cal = calcCalorie(food ? food.caloriePer100g : 0, eaten);
            breakdown = [{ foodCode: sourceCode, grams: eaten, calorie: cal }];
            calorie = cal;
          } else {
            const recipe = allRecipes.find(x => x.code === sourceCode);
            if (!recipe) result.errors.push(`${date}: 未登録のレシピコード ${sourceCode}`);
            const totalRatio = ((recipe && recipe.components) || []).reduce((s, c) => s + (Number(c.ratio) || 0), 0) || 1;
            breakdown = ((recipe && recipe.components) || []).map(c => {
              const grams = Math.round(eaten * ((Number(c.ratio) || 0) / totalRatio) * 100) / 100;
              const food = allFoods.find(x => x.code === c.foodCode);
              return { foodCode: c.foodCode, grams, calorie: calcCalorie(food ? food.caloriePer100g : 0, grams) };
            });
            calorie = Math.round(breakdown.reduce((s, b) => s + b.calorie, 0) * 10) / 10;
          }
        }

        await put('feedingLog', {
          catCode,
          date,
          time: f.time,
          kind,
          sourceType,
          sourceCode,
          providedAmount: provided,
          eatenAmount: eaten,
          breakdown,
          calorie,
          memo: f.memo || ''
        });
        result.feeding++;
      }
    }

    // ---- medicineLog: この日の分を作り直す ----
    if (Array.isArray(day.medicine)) {
      const existingMed = await getByIndex('medicineLog', 'byCatDate', [catCode, date]);
      for (const row of existingMed) await remove('medicineLog', row.id);

      for (const m of day.medicine) {
        await put('medicineLog', {
          catCode,
          date,
          time: m.time,
          medicineCode: m.medicineCode,
          dose: m.dose != null ? Number(m.dose) : null,
          memo: m.memo || ''
        });
        result.medicine++;
      }
    }

    // ---- excretionLog（うんち／ゲロ）: この日・この種別の分を作り直す ----
    for (const [key, type] of [['poop', 'POOP'], ['vomit', 'VOMIT']]) {
      if (Array.isArray(day[key])) {
        const existingExc = (await getByIndex('excretionLog', 'byCatDate', [catCode, date])).filter(e => e.type === type);
        for (const row of existingExc) await remove('excretionLog', row.id);

        for (const e of day[key]) {
          await put('excretionLog', {
            catCode,
            date,
            time: e.time,
            type,
            stateCodes: e.stateCodes || [],
            memo: e.memo || ''
          });
          result[key]++;
        }
      }
    }

    // ---- memoLog: この日の分を作り直す ----
    if (Array.isArray(day.memos)) {
      const existingMemo = await getByIndex('memoLog', 'byCatDate', [catCode, date]);
      for (const row of existingMemo) await remove('memoLog', row.id);

      for (const mm of day.memos) {
        await put('memoLog', { catCode, date, time: mm.time, memo: mm.text || '' });
        result.memos++;
      }
    }
  }

  return result;
}

export async function importCatDayLogFile(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error('JSONの形式が不正です: ' + err.message);
  }
  return applyCatDayLog(data);
}
