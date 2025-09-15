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
