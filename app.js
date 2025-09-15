// ---- Tabs (cél) ----
let currentGoal = "fogyas";
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    currentGoal = btn.dataset.goal;
    toast(`Aktuális cél: ${labelFor(currentGoal)}.`);
  });
});

function labelFor(goal){
  return goal === "fogyas" ? "Fogyás" : goal === "szalkasitas" ? "Szálkásítás" : "Hízás";
}

function toast(text){
  // egyszerű ARIA-jelzés: results div használata
  const r = document.getElementById("results");
  r.classList.remove("hidden");
  r.innerHTML = `<div class="kpi"><div>Info</div><div>${text}</div></div>`;
  setTimeout(()=>r.innerHTML="", 1200);
}

// ---- Kalkulátor ----
// Mifflin–St Jeor BMR, majd TDEE = BMR * activity
function calcBMR({sex, age, height, weight}){
  // height: cm, weight: kg
  return sex === "male"
    ? 10*weight + 6.25*height - 5*age + 5
    : 10*weight + 6.25*height - 5*age - 161;
}
function clamp(n, min, max){ return Math.min(max, Math.max(min, n)); }

function macrosFor(goal, weightKg, tdee){
  // Ajánlott beállítások (általános irányelvek, nem orvosi tanács)
  // fehérje: 1.8–2.2 g/kg; zsír: 0.8–1.0 g/kg; CH feltöltés kalóriáig
  const proteinG = Math.round(weightKg * (goal === "hizas" ? 1.8 : 2.0));
  const fatG = Math.round(weightKg * (goal === "szalkasitas" ? 0.8 : 0.9));

  let targetCalories = tdee;
  if (goal === "fogyas") targetCalories = Math.round(tdee * 0.75);         // ~25% deficit
  if (goal === "szalkasitas") targetCalories = Math.round(tdee * 0.80);    // ~20% deficit
  if (goal === "hizas") targetCalories = Math.round(tdee * 1.10);           // ~10% szuficit

  const kcalFromProtein = proteinG * 4;
  const kcalFromFat = fatG * 9;
  const carbsKcal = clamp(targetCalories - (kcalFromProtein + kcalFromFat), 0, 100000);
  const carbsG = Math.round(carbsKcal / 4);

  return { targetCalories, proteinG, fatG, carbsG };
}

const $ = sel => document.querySelector(sel);
$("#calc").addEventListener("submit", e=>{
  e.preventDefault();
  const sex = $("#sex").value;
  const age = +$("#age").value;
  const height = +$("#height").value;
  const weight = +$("#weight").value;
  const activity = +$("#activity").value;

  const bmr = calcBMR({sex, age, height, weight});
  const tdee = Math.round(bmr * activity);
  const m = macrosFor(currentGoal, weight, tdee);

  const res = $("#results");
  res.classList.remove("hidden");
  res.innerHTML = `
    <div class="kpi"><div>Aktuális cél</div><div><strong>${labelFor(currentGoal)}</strong></div></div>
    <div class="kpi"><div>BMR</div><div>${Math.round(bmr)} kcal/nap</div></div>
    <div class="kpi"><div>TDEE</div><div>${tdee} kcal/nap</div></div>
    <div class="kpi"><div>Cél kalória</div><div><strong>${m.targetCalories} kcal/nap</strong></div></div>
    <div class="kpi"><div>Makrók</div>
      <div>
        Fehérje: <strong>${m.proteinG} g</strong><br/>
        Zsír: <strong>${m.fatG} g</strong><br/>
        Szénhidrát: <strong>${m.carbsG} g</strong>
      </div>
    </div>
  `;
});

// ---- AI chat ----
const chatLog = $("#chatLog");
const chatForm = $("#chatForm");
const chatInput = $("#chatInput");

function addMsg(role, text){
  const div = document.createElement("div");
  div.className = `msg ${role === "user" ? "me" : "bot"}`;
  div.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function escapeHtml(str){
  return str.replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
}

chatForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const userText = chatInput.value.trim();
  if(!userText) return;
  addMsg("user", userText);
  chatInput.value = "";
  addMsg("assistant", "Gondolkodom…");

  // küldjük a szerverless függvényhez
  try{
    const r = await fetch("/.netlify/functions/ai-chat", {
      method:"POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        goal: currentGoal,
        prompt: userText
      })
    });
    if(!r.ok){
      throw new Error(`Hálózati hiba: ${r.status}`);
    }
    const data = await r.json();
    // eltávolítjuk az ideiglenes "Gondolkodom…" üzenetet
    const last = chatLog.querySelector(".msg.bot:last-child");
    if (last) last.remove();
    addMsg("assistant", data.reply || "Bocsi, nem jött válasz.");
  }catch(err){
    const last = chatLog.querySelector(".msg.bot:last-child");
    if (last) last.remove();
    addMsg("assistant", "Hopp, hiba történt a chat hívásakor. Ellenőrizd a Netlify beállításokat és a kulcsot.");
    console.error(err);
  }
});
// ====== Onboarding ======
(function onboarding(){
  const onb = document.getElementById("onb");
  if(!localStorage.getItem("fit_onb_hide")){
    onb.classList.remove("hidden");
  }
  document.getElementById("onb-ok").addEventListener("click", ()=>{
    if(document.getElementById("onb-hide").checked){
      localStorage.setItem("fit_onb_hide","1");
    }
    onb.classList.add("hidden");
  });
})();

// ====== Gyakorlatok könyvtár ======
let EX = [];
const exGrid = document.getElementById("ex-grid");
const fMuscle = document.getElementById("f-muscle");
const fLevel = document.getElementById("f-level");
const fEquip = document.getElementById("f-equip");
const fQ = document.getElementById("f-q");

async function loadExercises(){
  try{
    const r = await fetch("data/exercises.json");
    EX = await r.json();
    renderExercises();
  }catch(e){
    console.error("Nem sikerült betölteni a gyakorlatokat:", e);
  }
}
function renderExercises(){
  const q = (fQ.value||"").toLowerCase();
  const mus = fMuscle.value;
  const lev = fLevel.value;
  const eq = fEquip.value;

  const list = EX.filter(x=>{
    return (!mus || x.muscle.includes(mus)) &&
           (!lev || x.level === lev) &&
           (!eq  || x.equip.includes(eq)) &&
           (!q   || x.name.toLowerCase().includes(q));
  });

  exGrid.innerHTML = list.map(x=>`
    <article class="ex-card" data-id="${x.id}">
      <img src="${x.img}" alt="${x.name}">
      <div class="ex-body">
        <div class="ex-name">${x.name}</div>
        <div class="ex-tags">${x.level} • ${x.muscle.join(", ")}</div>
      </div>
    </article>
  `).join("");

  exGrid.querySelectorAll(".ex-card").forEach(card=>{
    card.addEventListener("click", ()=> openExercise(card.dataset.id));
  });
}
[fMuscle,fLevel,fEquip,fQ].forEach(el=> el && el.addEventListener("input", renderExercises));

function openExercise(id){
  const x = EX.find(e=>e.id===id);
  if(!x) return;
  document.getElementById("exm-img").src = x.img;
  document.getElementById("exm-img").alt = x.name;
  document.getElementById("exm-name").textContent = x.name;
  document.getElementById("exm-meta").textContent = `${x.level} • ${x.muscle.join(", ")} • ${x.equip.join(", ")}`;
  document.getElementById("exm-steps").innerHTML = x.steps.map(s=>`<li>${s}</li>`).join("");
  document.getElementById("ex-modal").classList.remove("hidden");
}
document.getElementById("exm-close").addEventListener("click", ()=> {
  document.getElementById("ex-modal").classList.add("hidden");
});
window.addEventListener("keydown", (e)=>{ if(e.key==="Escape") document.getElementById("ex-modal").classList.add("hidden"); });

loadExercises();

// ====== Program generátor (3 nap, 6-8 gyakorlat/nap) ======
document.getElementById("p-gen").addEventListener("click", ()=>{
  const g = document.getElementById("p-goal").value;     // fogyas/szalkasitas/hizas
  const lvl = document.getElementById("p-level").value;  // kezdő/közép
  const days = genProgram(g, lvl);
  const out = document.getElementById("p-out");
  out.classList.remove("hidden");
  out.innerHTML = days.map((d,i)=>`
    <div class="kpi">
      <div>Nap ${i+1}</div>
      <div>
        ${d.map(x=>`${x.name} — ${x.suggest}`).join("<br/>")}
      </div>
    </div>
  `).join("");
});

function pick(list, n){
  const arr = [...list];
  const res = [];
  while(arr.length && res.length<n){
    const i = Math.floor(Math.random()*arr.length);
    res.push(arr.splice(i,1)[0]);
  }
  return res;
}
function genProgram(goal, level){
  // szűrés szintre + minimális eszköz (prefer saját testsúly)
  const pool = EX.filter(x=>{
    return (level==="kezdő" ? x.level!=="haladó" : true);
  });

  const day = (muscles)=> {
    const set = [];
    muscles.forEach(m=>{
      const subset = pool.filter(x=> x.muscle.includes(m));
      if(subset.length){
        set.push(pick(subset,1)[0]);
      }
    });
    // töltsük fel vegyesen 6-8 elemig
    const rest = pool.filter(x=> !set.includes(x));
    set.push(...pick(rest, Math.max(0, 6 - set.length)));
    return set.slice(0,8).map(x=> ({
      name: x.name,
      suggest: suggestRep(goal, x)
    }));
  };

  // 3 nap: alsó + felső + teljes/törzs
  return [
    day(["láb","far","kardió"]),
    day(["mell","hát","váll","kar"]),
    day(["törzs","teljes test","kardió"])
  ];
}
function suggestRep(goal, ex){
  // nagyon egyszerű ajánlás
  const isHold = /plank/i.test(ex.id);
  if(isHold) return (goal==="hizas" ? "3×45–60 mp" : "3×30–45 mp");
  if(goal==="hizas") return "4×8–12 ism.";
  if(goal==="szalkasitas") return "3–4×10–15 ism.";
  return "3×12–20 ism. vagy 30–45 mp";
}
