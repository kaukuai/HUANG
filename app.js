const i18n = {
  'zh-Hant': { language:'語言', applyBatch:'套用到整批照片', upload:'上傳照片', uploadRef:'上傳參考圖', refHint:'上傳後會優先參考色調、布景、風格。', quickPreset:'靈感尺寸快速選擇', tonePreset:'色調 / 對比色預設', styleSet:'Set Style', lockedSeries:'菜單系列一致性', lockBackground:'固定背景風格', lockLighting:'固定光源方向', lockColor:'固定色調', lockAngle:'固定拍攝角度', preview:'預覽', angles:'13 種常用拍攝角度', adjust:'調整面板', generate:'生成商業級照片' },
  'zh-Hans': { language:'语言', applyBatch:'应用到整批照片', upload:'上传照片', uploadRef:'上传参考图', refHint:'上传后会优先参考色调、布景、风格。', quickPreset:'灵感尺寸快速选择', tonePreset:'色调 / 对比色预设', styleSet:'Set Style', lockedSeries:'菜单系列一致性', lockBackground:'固定背景风格', lockLighting:'固定光源方向', lockColor:'固定色调', lockAngle:'固定拍摄角度', preview:'预览', angles:'13 种常用拍摄角度', adjust:'调整面板', generate:'生成商业级照片' },
  en: { language:'Language', applyBatch:'Apply to all photos', upload:'Upload Photo', uploadRef:'Upload Reference', refHint:'Reference image style, tone and props will be prioritized.', quickPreset:'Quick Aspect Presets', tonePreset:'Tone / Contrast Presets', styleSet:'Set Style', lockedSeries:'Series Consistency', lockBackground:'Lock background style', lockLighting:'Lock light direction', lockColor:'Lock color tone', lockAngle:'Lock camera angle', preview:'Preview', angles:'13 Common Shooting Angles', adjust:'Adjustment Panel', generate:'Generate Commercial Shot' },
  ja: { language:'言語', applyBatch:'一括適用', upload:'写真をアップロード', uploadRef:'参考画像をアップロード', refHint:'参考画像の色調・背景・雰囲気を優先します。', quickPreset:'サイズのクイック選択', tonePreset:'トーン / コントラスト', styleSet:'Set Style', lockedSeries:'メニューシリーズ統一', lockBackground:'背景スタイルを固定', lockLighting:'光源方向を固定', lockColor:'色調を固定', lockAngle:'撮影角度を固定', preview:'プレビュー', angles:'13種類の撮影アングル', adjust:'調整パネル', generate:'商業品質で生成' },
  ko: { language:'언어', applyBatch:'전체 사진에 적용', upload:'사진 업로드', uploadRef:'참고 이미지 업로드', refHint:'참고 이미지의 톤/스타일/배경을 우선 반영합니다.', quickPreset:'빠른 비율 선택', tonePreset:'톤 / 대비 프리셋', styleSet:'Set Style', lockedSeries:'메뉴 시리즈 일관성', lockBackground:'배경 스타일 고정', lockLighting:'광원 방향 고정', lockColor:'색조 고정', lockAngle:'촬영 각도 고정', preview:'미리보기', angles:'자주 쓰는 13가지 앵글', adjust:'조정 패널', generate:'상업용 퀄리티 생성' }
};

const controls = [
  ['焦距景深 / DOF', 'dof', 0, 100, 45],
  ['主體色調', 'subjectTone', 0, 100, 50],
  ['布景風格強度', 'setStyleStrength', 0, 100, 60],
  ['AI 發揮程度', 'aiFreedom', 0, 100, 40],
  ['主體清晰度', 'subjectSharpness', 0, 100, 70],
  ['陰影柔和度', 'shadowSoftness', 0, 100, 55],
  ['高光壓制', 'highlightControl', 0, 100, 35],
  ['材質細節', 'textureDetail', 0, 100, 65],
];

const angles = [
 ['90° Top Down','🔝'],['75° Elevated','🧭'],['60° Hero','📐'],['45° Classic','📸'],
 ['30° Dining','🍽️'],['Eye Level','👁️'],['Low Angle','⬆️'],['Macro Close-up','🔍'],
 ['Side Profile','↔️'],['Back 3/4','↙️'],['Front 3/4','↘️'],['Flat Lay Offset','🧩'],['Detail Cut-in','✂️']
];
const positions = ['Center','Top-Left','Top-Center','Top-Right','Middle-Left','Middle-Right','Bottom-Left','Bottom-Center','Bottom-Right'];
const lightDirs = ['不指定','側光','逆光','順光','45° 左前','45° 右前','頂光','底光'];
const styles = ['Minimal Nordic','Dark Moody','Rustic Wood','Luxury Fine Dining','Street Food','Japanese Clean','Cafe Lifestyle','Color Pop','Editorial Magazine','Vintage Film'];

function init(){
  const langSel = document.getElementById('languageSelect');
  Object.keys(i18n).forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=k; langSel.appendChild(o)});
  langSel.value='zh-Hant';
  langSel.addEventListener('change',()=>applyLang(langSel.value));
  applyLang(langSel.value);

  const sizePreset = document.getElementById('sizePreset');
  ['Uber Eats Food 1:1','Uber Eats Cover 3:1','foodpanda Food 4:3','foodpanda Cover 16:9','Instagram 4:5','Custom'].forEach(v=> sizePreset.add(new Option(v,v)));
  const tonePreset = document.getElementById('tonePreset');
  ['自然暖色','清新冷調','單色調 Monochrome','青橘 Teal & Orange','奶油柔霧','高反差黑金'].forEach(v=>tonePreset.add(new Option(v,v)));

  const styleOptions = document.getElementById('styleOptions');
  styles.forEach((s,i)=>{ const b=document.createElement('button'); b.className='chip'+(i===0?' active':''); b.textContent=s; b.onclick=()=>{[...styleOptions.children].forEach(x=>x.classList.remove('active')); b.classList.add('active')}; styleOptions.appendChild(b); });

  const controlsRoot = document.getElementById('controls');
  controls.forEach(([label,key,min,max,val])=>{
    const wrap=document.createElement('div'); wrap.className='control';
    wrap.innerHTML=`<label>${label}: <span id="${key}Val">${val}</span></label><input type="range" min="${min}" max="${max}" value="${val}" id="${key}">`;
    controlsRoot.appendChild(wrap);
    wrap.querySelector('input').addEventListener('input',e=>document.getElementById(`${key}Val`).textContent=e.target.value);
  });

  const extra = document.createElement('div');
  extra.innerHTML = `<label>主體位置</label><select id="subjectPosition"></select><label>光源方向</label><select id="lightDirection"></select>`;
  controlsRoot.appendChild(extra);
  positions.forEach(v=>document.getElementById('subjectPosition').add(new Option(v,v)));
  lightDirs.forEach(v=>document.getElementById('lightDirection').add(new Option(v,v)));

  const angleGrid=document.getElementById('angleGrid');
  angles.forEach((a,i)=>{ const d=document.createElement('div'); d.className='angle-item'+(i===3?' active':''); d.innerHTML=`<div class="icon">${a[1]}</div><div>${a[0]}</div>`; d.onclick=()=>{[...angleGrid.children].forEach(x=>x.classList.remove('active')); d.classList.add('active')}; angleGrid.appendChild(d); });

  document.getElementById('imageUpload').addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return; const url=URL.createObjectURL(f); document.getElementById('previewImage').src=url;
  });
}

function applyLang(lang){
  document.querySelectorAll('[data-i18n]').forEach(el=>{ const key=el.dataset.i18n; el.textContent=i18n[lang][key] || key; });
}

init();
