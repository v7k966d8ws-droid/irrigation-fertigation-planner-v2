
let editingDraftShiftIndex=-1;
let vatPrepareExpanded=false;

function plansForDate(date){return state.plans.filter(p=>(p.nightDate||p.date)===date).sort((a,b)=>dtValue(a.date,a.startTime)-dtValue(b.date,b.startTime))}
function orderedInjectors(items){return (items||[]).filter(x=>x&&x.type!=="unused").slice().sort((a,b)=>(Number(a.sequenceOrder)||0)-(Number(b.sequenceOrder)||0))}

function defaultProgramName(farm,date){return `${farm||"Farm"} — ${fmt(date||today())}`}
function updateDefaultProgramName(force=false){const el=$("programName");if(!el||activeProgram())return;if(force||el.dataset.autoName!=="0"){el.value=defaultProgramName($("farm")?.value,$("nightDate")?.value);el.dataset.autoName="1"}}
function refreshShiftPumpHint(){const farm=$("farm")?.value||"",all=configuredPumps(farm,true),fert=fertigationPumps(farm),hint=$("shiftPumpHint");if(hint)hint.innerHTML=`Available: <strong>${all.length?all.map(p=>esc(p.name)).join(", "):"none configured"}</strong>${fert.length?` · Fertigation pump: <strong>${fert.map(p=>esc(p.name)).join(", ")}</strong>`:" · No fertigation-capable pump marked yet."}`}
function autoSelectFertigationPump(){if(currentPhaseMode()!=="fertigation")return;const fert=fertigationPumps($("farm").value);if(fert.length)$("shiftPumps").value=fert.map(p=>p.name).join(", ")}
function activeProgram(){return state.activeProgram&&state.activeProgram.id?state.activeProgram:null}
function draftShifts(){const a=activeProgram();return a&&Array.isArray(a.draftShifts)?a.draftShifts:[]}
function nextJobNumber(){return draftShifts().length+1}
function currentPhaseMode(){return $("shiftMode")?.value||"water"}
function vatMemoryKey(farm,product){return `${farm||""}|${product||""}`}
function storedPreparedVatForFarm(farm){return state.activeVatMix?.[farm]||null}
function preparedVatForFarm(farm){const v=storedPreparedVatForFarm(farm);return v&&v.completed!==true?v:null}
function preparedVatSeedInjectors(farm){
 const v=preparedVatForFarm(farm),items=rememberedInjectors(farm);
 if(!v)return items;
 const idx=Math.max(0,Math.min(3,Number(v.injectorIndex)||0));
 while(items.length<4)items.push({type:"unused",sequenceOrder:items.length});
 items[idx]={...(items[idx]||{}),type:"product",name:v.product,rate:Number(v.rate)||0,unit:"kg/ha",qty:0,solutionVolume:0,preflow:0,preflowManual:false,runtime:0,calculatedRuntime:0,runtimeManual:false,batchMode:"continue",batchName:v.batchName||"",batchStartAmount:0,vatBuilder:true,outletAllocations:[],productRuntime:0,vatRinseTime:0};
 return items
}
function vatRequired(){return $("vatRequired")?.value==="yes"}
function rememberVatRate(farm,product,rate,volume,injectorIndex){
 if(!farm||!product)return;
 state.vatMixMemory[vatMemoryKey(farm,product)]={rate:Number(rate)||0,volume:Number(volume)||1500,injectorIndex:Number(injectorIndex)||0,updated:new Date().toISOString()};
}
function loadLastVatSettings(){
 const farm=$("farm")?.value||"",product=$("mixProduct")?.value||"",m=state.vatMixMemory?.[vatMemoryKey(farm,product)];
 if(m){
   if(Number(m.rate)>0)$("mixRate").value=Number(m.rate);
   if(Number(m.volume)>0)$("mixVolume").value=Number(m.volume);
   if(Number.isInteger(Number(m.injectorIndex))&&$("mixInjector").options[Number(m.injectorIndex)])$("mixInjector").value=String(Number(m.injectorIndex));
 }
}
function syncPreparedVatStatus(){
 const box=$("preparedVatStatus");if(!box)return;
 const farm=$("farm")?.value||"",v=preparedVatForFarm(farm);
 if(!v){box.innerHTML="<strong>No vat prepared yet.</strong><br><span class='muted'>If a mixed vat is required, choose Yes and prepare it before building the jobs.</span>";return}
 const used=new Set();
 (draftShifts()||[]).filter(j=>j.phaseMode==="fertigation").forEach(j=>(j.outlets||[]).forEach(o=>{if((v.outlets||[]).includes(o))used.add(o)}));
 const usedArea=[...used].reduce((s,o)=>s+(Number(FARMS[farm]?.[o])||0),0);
 const remainingArea=Math.max(0,(Number(v.totalArea)||0)-usedArea);
 const remainingL=(Number(v.totalArea)||0)>0?(Number(v.volume)||0)*(remainingArea/Number(v.totalArea)):0;
 const done=remainingL<0.05,prepared=(v.outlets||[]),fertigated=prepared.filter(o=>used.has(o)),still=prepared.filter(o=>!used.has(o));
 box.innerHTML=`<div class="vatStatusDashboard"><div class="vatStatusDetails"><div class="vatStatusTitle"><strong>${esc(v.batchName)}${done?" — COMPLETE":""}</strong></div><div class="vatStatusLine">${esc(v.product)} · ${Number(v.volume||0).toLocaleString("en-AU")} L · ${Number(v.rate)} kg/ha · ${Number(v.totalKg).toFixed(1)} kg · ${esc(state.injectorConfig?.[farm]?.[Number(v.injectorIndex)||0]?.name||`Injector ${(Number(v.injectorIndex)||0)+1}`)}</div><div class="vatStatusLine"><span class="vatLabel">Prepared for:</span> <strong>${prepared.map(esc).join(", ")}</strong></div>${fertigated.length?`<div class="vatStatusLine vatDone"><span class="vatLabel">✓ Fertigated:</span> <strong>${fertigated.map(esc).join(", ")}</strong></div>`:""}<button type="button" id="toggleVatPrepareDetails" class="vatDetailsToggle secondary">${vatPrepareExpanded?"Hide vat details":"Show / edit vat details"}</button></div><div class="vatStillHero ${done?"complete":""}"><span>${done?"VAT COMPLETE":"STILL TO FERTIGATE"}</span><strong>${done?"✓":still.map(esc).join(", ")}</strong></div><div class="vatRemainingHero"><strong>${Number(remainingL.toFixed(1)).toLocaleString("en-AU")} L</strong><span>remaining</span></div></div>`;
}

function syncPreparedVatOutletChoices(){
 const box=$("outlets");if(!box)return;
 box.parentElement?.querySelector(".currentJobOutletSummary")?.remove();
 box.classList.remove("preparedVatLiveChoices");
 box.querySelectorAll("label.outlet").forEach(l=>{l.classList.remove("vatUnavailable","vatChosenNow");l.style.display=""});
 if(currentPhaseMode()!=="fertigation")return;
 const farm=$("farm")?.value||"",v=preparedVatForFarm(farm);if(!v)return;
 const prepared=new Set(v.outlets||[]),already=new Set();
 draftShifts().filter(j=>j.phaseMode==="fertigation").forEach(j=>(j.outlets||[]).forEach(o=>{if(prepared.has(o))already.add(o)}));
 const chosen=[];
 box.classList.add("preparedVatLiveChoices");
 box.querySelectorAll("label.outlet").forEach(l=>{
   const cb=l.querySelector("input"),o=cb?.value;if(!cb||!prepared.has(o)){l.style.display="none";return}
   if(already.has(o)&&!cb.checked){l.style.display="none";l.classList.add("vatUnavailable");return}
   if(cb.checked){chosen.push(o);l.style.display="none";l.classList.add("vatChosenNow")}
 });
 const wrap=box.parentElement;if(wrap&&chosen.length){
   const s=document.createElement("div");s.className="currentJobOutletSummary";
   s.innerHTML=`<span>Selected for this job:</span><strong>${chosen.map(esc).join(", ")}</strong><button type="button" class="secondary smallbtn">Change selection</button>`;
   s.querySelector("button").addEventListener("click",()=>{box.querySelectorAll("input:checked").forEach(cb=>{cb.checked=false});recalc();renderIndividualValveRuntimes();renderInlineVatSummary();applyPreparedVatToCurrentJob(true);syncPreparedVatStatus();syncPreparedVatOutletChoices()});
   wrap.insertBefore(s,box);
 }
 const visible=[...box.querySelectorAll("label.outlet")].some(l=>l.style.display!=="none");
 if(!visible&&!chosen.length){const e=document.createElement("div");e.className="vatOutletEmpty muted";e.textContent="All prepared-vat outlets have already been allocated to jobs.";box.appendChild(e)}
}

function syncVatRequirementUI(){
 const fert=currentPhaseMode()==="fertigation",card=$("vatRequirementCard"),panel=$("vatPreparePanel");
 if(card)card.classList.toggle("hidden",!fert);
 if(!fert){if(panel)panel.classList.add("hidden");return}
 const existing=preparedVatForFarm($("farm")?.value||"");
 if(existing&&$("vatRequired"))$("vatRequired").value="yes";
 if(panel)panel.classList.toggle("hidden",!vatRequired()||!!existing&&!vatPrepareExpanded);
 syncPreparedVatStatus();
}
function prepareVatMix(){
 const d=inlineVatData(),product=$("mixProduct").value,batch=$("mixBatchName").value.trim(),idx=Number($("mixInjector").value);
 if(!product||!d.outs.length||!(d.rate>0)||!(d.volume>0)){alert("Choose the mixed product, every outlet this vat is being prepared for, the rate per hectare and the prepared vat volume.");return}
 if(!activeProgram()){const farm=d.farm,nightDate=$("nightDate").value||today(),name=$("programName").value.trim()||defaultProgramName(farm,nightDate);state.activeProgram={id:uid(),name,farm,nightDate,draftShifts:[],created:new Date().toISOString()};editingDraftShiftIndex=-1;save();renderProgramBanner()}
 if(!batch){alert("Enter a vat name.");return}
 const alloc=d.outs.map(o=>{const ha=Number(FARMS[d.farm]?.[o])||0;return{outlet:o,ha,productKg:Number((ha*d.rate).toFixed(4)),solutionL:Number((d.totalArea>0?d.volume*ha/d.totalArea:0).toFixed(4)),rateKgHa:d.rate}});
 state.activeVatMix[d.farm]={id:uid(),farm:d.farm,product,rate:d.rate,volume:d.volume,batchName:batch,injectorIndex:idx,outlets:[...d.outs],totalArea:d.totalArea,totalKg:d.totalKg,allocations:alloc,preparedAt:new Date().toISOString(),oneSessionVat:true};
 rememberVatRate(d.farm,product,d.rate,d.volume,idx);
 save();
 vatPrepareExpanded=false;
 syncVatRequirementUI();
 applyPreparedVatToCurrentJob(true);
 alert(`Vat prepared in V2.\n\n${batch}\n${d.totalArea.toFixed(2)} ha\n${d.totalKg.toFixed(1)} kg ${product}\n${d.volume.toFixed(0)} L prepared solution\n\nNow build the fertigation jobs normally. V2 will allocate this vat automatically by hectares and expects 0 L remaining after all selected outlets are completed.`);
}
function applyPreparedVatToCurrentJob(silent=true){
 if(currentPhaseMode()!=="fertigation"||!vatRequired())return false;
 const farm=$("farm")?.value||"",v=preparedVatForFarm(farm);if(!v)return false;
 const current=selected().filter(o=>(v.outlets||[]).includes(o));
 if(!current.length){
   // A prepared vat that still has outlets remaining must stay visibly attached
   // to the fresh next job, even before that job has any outlets selected.
   // Keep the source/product identity, but give the current job a zero allocation.
   const idx=Number(v.injectorIndex)||0,card=document.querySelector(`.inj[data-index="${idx}"]`);
   if(card){
     const type=card.querySelector(".itype"),name=card.querySelector(".iname"),rate=card.querySelector(".irate"),unit=card.querySelector(".iunit"),batch=card.querySelector(".ibatch"),mode=card.querySelector(".ibatchmode"),start=card.querySelector(".ibatchstart"),sol=card.querySelector(".isolution"),run=card.querySelector(".iruntimeinput");
     if(type)type.value="product";
     if(name)name.value=v.product;
     if(rate)rate.value=Number(v.rate)||0;
     if(unit)unit.value="kg/ha";
     if(batch)batch.value=v.batchName||"";
     if(mode)mode.value="continue";
     if(start)start.value=0;
     if(sol)sol.value=0;
     if(run)run.value="";
     card.dataset.vatBuilder="1";card.dataset.vatAllocations="[]";
     if(type)type.dispatchEvent(new Event("change",{bubbles:true}));
     // The type change updates field visibility; reassert the prepared-vat marker
     // and hide controls that are automatic for a one-session prepared vat.
     card.dataset.vatBuilder="1";card.dataset.vatAllocations="[]";
     const modeWrap=mode?.parentElement;if(modeWrap)modeWrap.style.display="none";
     const startWrap=card.querySelector(".batchStartField");if(startWrap)startWrap.style.display="none";
     recalc();syncPreparedVatStatus();
   }
   return false
 }
 const currentArea=current.reduce((s,o)=>s+(Number(FARMS[farm]?.[o])||0),0);
 const currentKg=currentArea*Number(v.rate||0),solution=Number(v.totalArea)>0?Number(v.volume)*(currentArea/Number(v.totalArea)):0,idx=Number(v.injectorIndex)||0;
 const card=document.querySelector(`.inj[data-index="${idx}"]`);if(!card)return false;
 document.querySelectorAll(".inj").forEach(other=>{
   if(other===card)return;
   const otherType=other.querySelector(".itype")?.value,otherName=other.querySelector(".iname")?.value||"";
   if(otherType==="product"&&String(otherName).trim().toLowerCase()===String(v.product).trim().toLowerCase()){
     other.querySelector(".itype").value="unused";other.dataset.vatBuilder="0";other.dataset.vatAllocations="[]";
     other.querySelector(".itype").dispatchEvent(new Event("change",{bubbles:true}));
   }
 });
 const earlierVatUse=draftShifts().reduce((sum,p)=>sum+(p.injectors||[]).reduce((inner,x)=>inner+(x&&x.type==="product"&&x.name===v.product&&x.batchName===v.batchName?Number(x.solutionVolume||0):0),0),0);
 const prior=earlierVatUse>0;
 const jobAlloc=(v.allocations||[]).filter(a=>current.includes(a.outlet));
 card.dataset.vatBuilder="1";card.dataset.vatAllocations=JSON.stringify(jobAlloc);
 card.querySelector(".itype").value="product";card.querySelector(".iname").value=v.product;card.querySelector(".irate").value=v.rate;card.querySelector(".iunit").value="kg/ha";
 card.querySelector(".ibatch").value=v.batchName;card.querySelector(".isolution").value=Number(solution.toFixed(1));card.querySelector(".ibatchmode").value=prior?"continue":"new";card.querySelector(".ibatchstart").value=prior?0:v.volume;
 const modeWrap=card.querySelector(".ibatchmode")?.parentElement;if(modeWrap)modeWrap.style.display="none";
 const startWrap=card.querySelector(".batchStartField");if(startWrap)startWrap.style.display="none";
 card.querySelector(".itype").dispatchEvent(new Event("change",{bubbles:true}));recalc();
 const remembered=injData().map(x=>({...x}));state.fertigationMemory[farm]=remembered;save();syncPreparedVatStatus();
 if(!silent)alert(`${current.join(", ")} allocated ${solution.toFixed(1)} L of ${v.batchName} (${currentKg.toFixed(1)} kg target).`);
 return true
}
function preparedVatCoverage(){
 const farm=$("farm")?.value||activeProgram()?.farm||"",v=storedPreparedVatForFarm(farm);if(!v)return{vat:null,missing:[],used:[]};
 const used=new Set();draftShifts().filter(j=>j.phaseMode==="fertigation").forEach(j=>(j.outlets||[]).forEach(o=>{if((v.outlets||[]).includes(o))used.add(o)}));
 return{vat:v,missing:(v.outlets||[]).filter(o=>!used.has(o)),used:[...used]}
}
function preparedVatIsComplete(farm){
 const v=preparedVatForFarm(farm),c=preparedVatCoverage();return !!(v&&c.missing.length===0)
}
function clearPreparedVatDraftFromInjectors(farm){
 const v=preparedVatForFarm(farm);if(!v)return;
 document.querySelectorAll(".inj").forEach(card=>{
   const sameVat=card.dataset.vatBuilder==="1"||(
     String(card.querySelector(".iname")?.value||"").trim().toLowerCase()===String(v.product||"").trim().toLowerCase()&&
     String(card.querySelector(".ibatch")?.value||"").trim()===String(v.batchName||"").trim()
   );
   if(!sameVat)return;
   card.dataset.vatBuilder="0";card.dataset.vatAllocations="[]";
   const type=card.querySelector(".itype");if(type){type.value="unused";type.dispatchEvent(new Event("change",{bubbles:true}))}
 });
}

function selectedShiftPumps(){return ($("shiftPumps")?.value||"").split(",").map(s=>s.trim()).filter(Boolean)}
function selectedOutletTravelMinutes(){
 const farm=$("farm")?.value||"",outs=selected();
 if(!farm||!outs.length)return 0;
 return outs.reduce((max,o)=>{
   const r=state.rotation[farm+"|"+o]||{};
   return Math.max(max,Math.max(0,Math.round(Number(r.fertilizerTravelMinutes)||0)))
 },0)
}
function fertFinishMinutes(){
 return selectedOutletTravelMinutes()
}
function getIndividualValveRuntimes(){
 if(!$("useIndividualValveRuntimes")?.checked)return{};
 const out={};
 document.querySelectorAll("#individualValveRuntimes input[data-outlet]").forEach(i=>{out[i.dataset.outlet]=Math.max(0,Number(i.value)||0)});
 return out
}
function renderIndividualValveRuntimes(existing=null){
 const box=$("individualValveRuntimes"),on=$("useIndividualValveRuntimes")?.checked;
 if(!box)return;
 box.classList.toggle("hidden",!on);
 if(!on){box.innerHTML="";return}
 const hours=Math.max(0,Number($("duration")?.value)||0),outs=selected(),old=existing||{};
 box.innerHTML=outs.length?outs.map(o=>`<div class="valveRuntime"><label>${esc(o)} runtime (hours)</label><input data-outlet="${esc(o)}" type="number" min="0" step="0.05" value="${old[o]!==undefined?Number(old[o]):hours}"></div>`).join(""):'<div class="muted">Select outlets first.</div>'
}
function syncShiftMode(){
 const mode=currentPhaseMode(),water=mode==="water",timingCard=$("fertigationTimingCard"),injCard=$("injectionProgrammingCard"),waterNote=$("waterOnlyInjectionNote");
 const outletHeading=$("jobOutletHeading"),outletHelp=$("jobOutletHelp");
 if(outletHeading)outletHeading.textContent=water?"Choose outlets to irrigate":"Choose outlets to fertigate";
 if(outletHelp)outletHelp.textContent=water?"Select the outlets to include in this irrigation job.":"Select the outlets to include in this fertigation job.";
 if(timingCard)timingCard.classList.toggle("hidden",water);
 if(injCard)injCard.classList.toggle("hidden",water);
 if(waterNote)waterNote.classList.toggle("hidden",!water);
 if(water){
   if(!irrigationOnly)draftInjectionBeforeIrrigationOnly=injData();
   irrigationOnly=true;renderInjectors(emptyInjectorsForFarm($("farm").value));updateInjectionMode()
 }else{
   irrigationOnly=false;
   const restore=draftInjectionBeforeIrrigationOnly&&draftInjectionBeforeIrrigationOnly.length?draftInjectionBeforeIrrigationOnly:rememberedInjectors($("farm").value);
   draftInjectionBeforeIrrigationOnly=null;renderInjectors(restore);updateInjectionMode();recalc()
 }
 if($("irrigationOnlyBtn")){$("irrigationOnlyBtn").disabled=true;$("irrigationOnlyBtn").textContent=water?"Water Only Job":"Fertigation Job"}
 refreshShiftPumpHint();if(!water){autoSelectFertigationPump();syncVatRequirementUI();setTimeout(()=>applyPreparedVatToCurrentJob(true),0)}else syncVatRequirementUI();
 if($("savePlan"))$("savePlan").textContent=activeProgram()?(editingDraftShiftIndex>=0?"Update Job":"Add Job to Program"):(editingPlanId?"Save Changes":"Start Program & Add Job");
 if($("fertTimingResult")&&water)$("fertTimingResult").textContent=""
}
function useSavedPumpRule(){
 const pumps=requiredPumps();if(!pumps.length){alert("There is no exact saved pump rule for the currently selected outlet group.");return}
 $("shiftPumps").value=pumps.join(", ")
}
function autoFertigationPreflow(){
 if(currentPhaseMode()!=="fertigation"){alert("Choose Fertigation for this job first.");return}
 const hours=Number($("duration").value)||0;if(!(hours>0)){alert("Enter the irrigation duration first.");return}
 const active=[...document.querySelectorAll(".inj")].filter(d=>d.querySelector(".itype").value!=="unused");
 if(!active.length){alert("Add at least one injection or flush action first.");return}
 const totalRuntime=active.reduce((s,d)=>s+Math.max(0,Math.round(Number(d.querySelector(".iruntimeinput").value)||0)),0);
 const finishBefore=fertFinishMinutes(),available=Math.round(hours*60)-finishBefore,firstPreflow=available-totalRuntime,result=$("fertTimingResult");
 if(firstPreflow<0){result.textContent=`The injection sequence needs ${totalRuntime} min but only ${Math.max(0,available)} min is available before the ${finishBefore}-minute fresh-water finish period.`;alert("The injection sequence will not fit inside this irrigation job with the selected finish target.");return}
 const first=active[0];first.querySelector(".ipreflow").value=Math.max(0,Math.round(firstPreflow));first.dataset.preflowManual="1";active.slice(1).forEach(d=>d.dataset.preflowManual="0");recalc();
 const finalFinish=Math.round(firstPreflow+totalRuntime);
 result.innerHTML=`Outlet travel time used: <strong>${finishBefore} min</strong>. First AquaLink Preflow: <strong>${Math.round(firstPreflow)} min</strong>. Injection sequence: <strong>${totalRuntime} min</strong>. Fertigation/rinse finishes at about <strong>${finalFinish} min</strong> into the ${Math.round(hours*60)}-minute job, leaving <strong>${finishBefore} min</strong> clean-water travel time.`
}
function renderDraftShiftList(){
 const host=$("draftShiftList");if(!host)return;const a=activeProgram(),jobs=draftShifts();
 if(!a){host.innerHTML="";return}
 if(!jobs.length){host.innerHTML='<div class="empty">No jobs added yet. Build Job 1 below.</div>';return}
 host.innerHTML=jobs.map((s,i)=>{
   const pumps=(s.shiftPumps||s.requiredPumps||[]).map(esc).join(", ")||"No pumps entered",valve=s.useIndividualValveRuntimes?" · Individual valve runtimes":"";
   return `<div class="draftShiftCard"><div class="draftShiftTop"><div class="draftShiftNumber">Job ${i+1}</div><div><strong>${esc(s.farm)} — ${(s.outlets||[]).map(esc).join(", ")}</strong><div class="muted">${pumps}</div></div><div><strong>${fmtTime(s.startTime)}</strong><div class="muted">${s.setRuntime||setRuntime(s.hours)}</div></div><div>${s.phaseMode==="fertigation"?'<span class="phaseBadge fert">Fertigation</span>':'<span class="phaseBadge water">Water Only</span>'}<div class="muted">${s.phaseMode==="fertigation"?`${Number(s.fertigationFinishBefore)||60} min fresh-water finish`:""}${valve}</div></div></div><div class="draftShiftActions"><button type="button" class="smallbtn" data-edit-draft="${i}">Edit Job</button><button type="button" class="smallbtn" data-remove-draft="${i}">Remove</button></div></div>`
 }).join("");
 host.querySelectorAll("[data-edit-draft]").forEach(b=>b.addEventListener("click",()=>editDraftShift(Number(b.dataset.editDraft))));
 host.querySelectorAll("[data-remove-draft]").forEach(b=>b.addEventListener("click",()=>removeDraftShift(Number(b.dataset.removeDraft))))
}
function totalSavedProgramWaterByOutlet(programId){
 const totals={};state.plans.filter(p=>p.programId===programId).forEach(p=>(p.outlets||[]).forEach(o=>{const hrs=p.useIndividualValveRuntimes&&p.individualValveRuntimes&&p.individualValveRuntimes[o]!==undefined?Number(p.individualValveRuntimes[o])||0:Number(p.hours)||0;const k=p.farm+"|"+o;totals[k]=(totals[k]||0)+hrs}));return totals
}
function renderProgramList(){
 const host=$("programList");if(!host)return;
 const date=$("planViewDate").value||today(),ps=plansForDate(date),ids=[...new Set(ps.filter(p=>p.programId).map(p=>p.programId))];host.innerHTML="";
 if(!ids.length){host.innerHTML='<div class="empty">No saved night programs for this date.</div>';return}
 ids.forEach(id=>{
   const jobs=ps.filter(p=>p.programId===id).sort((a,b)=>(Number(a.programSequence)||0)-(Number(b.programSequence)||0));
   const first=jobs[0],last=jobs[jobs.length-1],card=document.createElement("div");card.className="programCard";
   const totals=totalSavedProgramWaterByOutlet(id),totalText=Object.entries(totals).map(([k,h])=>`${esc(k.split("|")[1])}: ${Number(h).toLocaleString("en-AU",{maximumFractionDigits:2})} hr`).join(" · ");
   card.innerHTML=`<div class="programCardHead"><div><strong>${esc(first.programName||defaultProgramName(first.farm,first.nightDate||first.date))}</strong><div class="muted">${esc(first.farm)} · ${jobs.length} job${jobs.length===1?"":"s"} · ${fmtTime(first.startTime)} → ${fmtTime(last.finishTime)}${last.finishDate!==first.date?" next day":""}</div>${totalText?`<div class="totalWaterBox"><strong>Total programmed irrigation by outlet:</strong> ${totalText}</div>`:""}</div><span class="programPill">Saved Night Plan</span></div><div style="margin-top:8px">${jobs.map((job,i)=>`<div class="programSetRow"><div class="programSetNo">Job ${i+1}</div><div><strong>${esc(job.farm)} — ${(job.outlets||[]).map(esc).join(", ")}</strong><div class="muted">${(job.shiftPumps||job.requiredPumps||[]).map(esc).join(", ")||"No pumps entered"} · ${Number(job.area||0).toFixed(2)} ha</div></div><div><strong>${fmtTime(job.startTime)}</strong><div class="muted">${job.setRuntime||setRuntime(job.hours)}</div></div><div>${job.phaseMode==="fertigation"?'<span class="phaseBadge fert">Fertigation</span>':'<span class="phaseBadge water">Water Only</span>'}</div></div>`).join("")}</div>`;host.appendChild(card)
 })
}
function renderProgramBanner(){
 const a=activeProgram(),banner=$("programBanner"),txt=$("programStatusText"),pill=$("programStepPill"),name=$("programName");if(!banner||!txt||!pill||!name)return;
 if(!a){banner.classList.remove("active");pill.textContent="No active program";txt.textContent="Build the irrigation and fertigation jobs first, then save the whole program to Tonight's Plan.";$("farm").disabled=false;if($("saveNightProgram")){$("saveNightProgram").disabled=true;$("saveNightProgram").textContent="Save Whole Night Program"}renderDraftShiftList();syncShiftMode();return}
 banner.classList.add("active");name.value=a.name;$("farm").disabled=true;if($("saveNightProgram")){$("saveNightProgram").disabled=draftShifts().length===0;$("saveNightProgram").textContent="Finish & Save Whole Program"}
 const jobs=draftShifts();pill.textContent=`Next: Job ${jobs.length+1}`;
 txt.innerHTML=`<strong>${esc(a.name)}</strong> · ${esc(a.farm)} · night of ${esc(a.nightDate)} · ${jobs.length} draft job${jobs.length===1?"":"s"} · <strong>not saved to Tonight's Plan yet</strong>`;renderDraftShiftList();syncShiftMode()
}
function startIrrigationProgram(){
 const existing=activeProgram();if(existing&&!confirm(`A program is already being built: ${existing.name}. Discard its unsaved draft jobs and start again?`))return;
 const farm=$("farm").value,nightDate=$("nightDate").value||today(),name=$("programName").value.trim()||defaultProgramName(farm,nightDate);
 // A genuinely new program must never inherit a prepared vat from an earlier or abandoned program.
 if(state.activeVatMix&&state.activeVatMix[farm])delete state.activeVatMix[farm];
 state.activeProgram={id:uid(),name,farm,nightDate,draftShifts:[],created:new Date().toISOString()};editingDraftShiftIndex=-1;save();prepareNextShiftForm();renderProgramBanner();
 alert(`${name} started.\n\nBuild Job 1, then tap Add Job to Program. Nothing is added to Tonight's Plan until you finish and save the whole program.`)
}
function cancelIrrigationProgram(){
 const a=activeProgram();if(!a)return;if(draftShifts().length&&!confirm(`Discard ${draftShifts().length} unsaved draft job${draftShifts().length===1?"":"s"} from ${a.name}?`))return;
 if(state.activeVatMix&&state.activeVatMix[a.farm])delete state.activeVatMix[a.farm];state.activeProgram=null;editingDraftShiftIndex=-1;$("farm").disabled=false;save();resetNewForm();renderProgramBanner()
}
function recalcDraftFertigationPreflows(job){
 // Calculation-only pass for saved draft jobs. Do not recalculate or replace
 // injector runtimes here: they are authoritative values already produced by
 // the job form (including prepared-vat allocation and any final vat rinse).
 if(!job||job.phaseMode!=="fertigation")return;
 const active=orderedInjectors(job.injectors||[]);if(!active.length)return;
 const totalMinutes=Math.max(0,Math.round((Number(job.hours)||0)*60));
 const finishBefore=Math.max(0,Math.round(Number(job.fertigationFinishBefore)||0));
 const totalRuntime=active.reduce((sum,x)=>sum+Math.max(0,Math.round(Number(x.runtime)||0)),0);
 const firstPreflow=Math.max(0,totalMinutes-finishBefore-totalRuntime);
 let cursor=firstPreflow;
 active.forEach(x=>{
   x.preflow=Math.max(0,Math.round(cursor));
   x.preflowManual=false;
   cursor+=Math.max(0,Math.round(Number(x.runtime)||0));
 });
}
function applyFinalVatRinseToDraftJobs(){
 const a=activeProgram(),v=a?storedPreparedVatForFarm(a.farm):null,jobs=draftShifts();if(!a||!jobs.length)return;
 // Make this calculation idempotent. Remove any rinse that was previewed on an
 // earlier draft state, including the matching preflow shift on later injectors.
 jobs.forEach(j=>(j.injectors||[]).forEach(x=>{
   const rinse=Math.max(0,Number(x?.vatRinseTime)||0);
   if(rinse){x.runtime=Math.max(0,(Number(x.runtime)||0)-rinse);x.vatRinseTime=0;x.productRuntime=0}
   const preAdj=Math.max(0,Number(x?.vatRinsePreflowAdjustment)||0);
   if(preAdj){x.preflow=Math.max(0,(Number(x.preflow)||0)-preAdj);x.vatRinsePreflowAdjustment=0}
 }));
 if(!v){jobs.forEach(recalcDraftFertigationPreflows);return;}
 // Rinse belongs only to the job that completes every outlet assigned to this
 // prepared vat. A partially allocated vat must not receive the rinse yet.
 const coverage=preparedVatCoverage();if(coverage.missing.length){jobs.forEach(recalcDraftFertigationPreflows);return;}
 const candidates=jobs.map((j,i)=>({j,i})).filter(({j})=>j.phaseMode==="fertigation"&&(j.outlets||[]).some(o=>(v.outlets||[]).includes(o)));
 if(!candidates.length){jobs.forEach(recalcDraftFertigationPreflows);return;}
 const last=candidates[candidates.length-1].j,idx=Number(v.injectorIndex)||0,x=last.injectors?.[idx];if(!x||x.type!=="product"||!x.vatBuilder){jobs.forEach(recalcDraftFertigationPreflows);return;}
 const cfg=state.injectorConfig?.[a.farm]?.[idx]||{},rinse=Math.max(0,Math.round(Number(cfg.finalVatRinseMinutes)||0));if(!rinse){jobs.forEach(recalcDraftFertigationPreflows);return;}
 const oldRuntime=Math.max(0,Math.round(Number(x.runtime)||0));x.productRuntime=oldRuntime;x.vatRinseTime=rinse;x.runtime=oldRuntime+rinse;
 // Later injector actions must begin later because this vat injector now runs
 // for the fresh-water rinse period too. Store the adjustment so recalculation
 // can reverse it cleanly if jobs are edited or removed.
 const seq=Number(x.sequenceOrder)||0;(last.injectors||[]).forEach(y=>{if(y!==x&&y&&y.type!=="unused"&&(Number(y.sequenceOrder)||0)>seq){y.preflow=Math.max(0,Math.round(Number(y.preflow)||0)+rinse);y.vatRinsePreflowAdjustment=rinse}});
 // Rinse is now final. Position every saved fertigation sequence backwards
 // from irrigation finish using that job's Setup travel/finish-before time.
 // This deliberately changes preflow only; runtimes are never touched here.
 jobs.forEach(recalcDraftFertigationPreflows);
}
function saveNightProgram(){
 const a=activeProgram();if(!a){alert("Start a Night Program first.");return}
 const jobs=draftShifts();if(!jobs.length){alert("Add at least one job before saving the night plan.");return}
 const coverage=preparedVatCoverage();
 if(coverage.vat&&coverage.missing.length){alert(`The prepared vat cannot be finished yet.\n\n${coverage.vat.batchName} was prepared for: ${coverage.vat.outlets.join(", ")}\nStill not allocated to a fertigation job: ${coverage.missing.join(", ")}\n\nAdd those outlet(s) to the fertigation program so the planned vat balance finishes at 0 L.`);return}
 applyFinalVatRinseToDraftJobs();
 if(!confirm(`Save ${a.name} to Tonight's Plan?\n\n${jobs.length} job${jobs.length===1?"":"s"} will be saved together.`))return;
 jobs.forEach((s,i)=>state.plans.push({...s,id:uid(),programId:a.id,programName:a.name,programSequence:i+1,created:new Date().toISOString()}));
 const fert=[...jobs].reverse().find(s=>s.phaseMode==="fertigation"&&hasProductInjection(s.injectors));if(fert){const mem=copyInjectionSetup(fert.injectors);mem.forEach(x=>{if(x&&x.type==="product"&&x.batchName&&(x.batchMode==="new"||x.batchMode==="continue")){x.batchMode="continue";x.batchStartAmount=0}});state.fertigationMemory[a.farm]=mem}
 const date=a.nightDate;
 if(state.activeVatMix&&state.activeVatMix[a.farm])delete state.activeVatMix[a.farm];
 state.activeProgram=null;editingDraftShiftIndex=-1;$("farm").disabled=false;sortPlans();save();$("planViewDate").value=date;resetNewForm();renderProgramBanner();renderPlan();showPage("tonight");alert(`${a.name} saved to Tonight's Plan with ${jobs.length} jobs.`)
}
function prepareNextShiftForm(){
 const a=activeProgram();if(!a)return;const jobs=draftShifts(),last=jobs[jobs.length-1];

 // Preserve ordinary fertigation choices, but never preserve the prepared-vat
 // allocation from the job that has just been added. Each new job must earn
 // its own vat share from its selected outlets.
 if(last&&last.phaseMode==="fertigation"&&hasProductInjection(last.injectors)){
   const memory=copyInjectionSetup(last.injectors).map(x=>{
     if(x&&x.vatBuilder)return {...x,type:"unused",qty:0,solutionVolume:0,runtime:0,batchStartAmount:0,vatBuilder:false,outletAllocations:[]};
     return x
   });
   state.fertigationMemory[a.farm]=memory;save();
 }

 const activeVat=preparedVatForFarm(a.farm),coverage=preparedVatCoverage();
 const vatStillActive=!!(activeVat&&coverage.missing.length);
 const vatJustFinished=!!(activeVat&&!coverage.missing.length);
 // Once every prepared-vat outlet has been allocated, close the vat as a live
 // source immediately. Keep its record only so final-save validation and the
 // optional final rinse can still use the completed vat details.
 if(vatJustFinished){
   const stored=storedPreparedVatForFarm(a.farm);
   if(stored)stored.completed=true;
   save();
 }

 resetNewForm();$("farm").value=a.farm;renderOutlets();$("pumpSystem").value=GROUP[a.farm]||"";$("nightDate").value=a.nightDate;$("programName").value=a.name;

 // Same job type follows the previous job, except a completed one-session vat
 // is closed and must not be silently carried into Job 3+.
 $("shiftMode").value=vatStillActive?"fertigation":(last&&last.phaseMode==="fertigation"?"fertigation":"water");
 if($("vatRequired"))$("vatRequired").value=vatStillActive?"yes":"no";
 $("shiftPumps").value="";$("useIndividualValveRuntimes").checked=false;renderIndividualValveRuntimes();
 if(last)setStart(last.finishDate,last.finishTime,"Suggested after previous job finishes");else setStart(a.nightDate,"18:00","Default first job start — 6:00 PM");
 syncShiftMode();

 // Build the fresh job from the active prepared vat itself, not from ordinary
 // fertigation memory. This makes Job 2 deterministic even after Job 1 has
 // deliberately stripped its per-job vat allocation from memory.
 if(vatStillActive){
   renderInjectors(preparedVatSeedInjectors(a.farm));
   irrigationOnly=false;updateInjectionMode();
   if($("vatRequired"))$("vatRequired").value="yes";
   syncVatRequirementUI();
   applyPreparedVatToCurrentJob(true);
 }

 if(vatJustFinished){
   clearPreparedVatDraftFromInjectors(a.farm);
   // The vat remains in program history for final-save validation/rinse logic,
   // but it is no longer an active source for the fresh job form.
   if($("vatRequired"))$("vatRequired").value="no";
   syncVatRequirementUI();
 }
 // A new job with no outlets selected must always start with zero vat allocation.
 // The active-vat seed above has already attached the source with a 0 L share.
 syncPreparedVatStatus();renderProgramBanner()
}
function resetShiftExtras(){
 if($("shiftPumps"))$("shiftPumps").value="";if($("useIndividualValveRuntimes"))$("useIndividualValveRuntimes").checked=false;renderIndividualValveRuntimes();
 if($("fertFinishBefore"))$("fertFinishBefore").value="60";if($("fertFinishCustomWrap"))$("fertFinishCustomWrap").classList.add("hidden");if($("fertTimingResult"))$("fertTimingResult").textContent="";editingDraftShiftIndex=-1;syncShiftMode()
}
function addOrUpdateDraftShift(){
 const a=activeProgram();if(!a)return false;const data=validatePlan();if(!data)return true;
 if(data.farm!==a.farm){alert(`This program is for ${a.farm}.`);return true}if(data.nightDate!==a.nightDate){alert(`This program is for the night of ${a.nightDate}.`);return true}
 data.phaseMode=currentPhaseMode();data.shiftPumps=selectedShiftPumps();data.requiredPumps=data.shiftPumps.length?data.shiftPumps:data.requiredPumps;data.useIndividualValveRuntimes=$("useIndividualValveRuntimes").checked;data.individualValveRuntimes=getIndividualValveRuntimes();data.fertigationFinishBefore=data.phaseMode==="fertigation"?fertFinishMinutes():0;
 if(data.phaseMode==="water"){data.irrigationOnly=true;data.injectors=emptyInjectorsForFarm(data.farm);data.fertigationFinishBefore=0}else data.irrigationOnly=false;
 if(!data.shiftPumps.length&&!confirm("No pumps have been entered for this job.\n\nAdd the job anyway?"))return true;
 const jobs=draftShifts();data.programSequence=editingDraftShiftIndex>=0?(jobs[editingDraftShiftIndex].programSequence||editingDraftShiftIndex+1):jobs.length+1;
 if(editingDraftShiftIndex>=0)jobs[editingDraftShiftIndex]={...jobs[editingDraftShiftIndex],...data,updated:new Date().toISOString()};else jobs.push({id:"draft-"+uid(),...data,created:new Date().toISOString()});
 jobs.forEach((j,i)=>j.programSequence=i+1);a.draftShifts=jobs;applyFinalVatRinseToDraftJobs();save();editingDraftShiftIndex=-1;prepareNextShiftForm();return true
}
function savePlan(){
 if(activeProgram()){addOrUpdateDraftShift();return}
 if(!editingPlanId){
   const data=validatePlan();if(!data)return;const farm=data.farm,nightDate=data.nightDate||$("nightDate").value||today(),name=$("programName").value.trim()||defaultProgramName(farm,nightDate);
   state.activeProgram={id:uid(),name,farm,nightDate,draftShifts:[],created:new Date().toISOString()};editingDraftShiftIndex=-1;save();renderProgramBanner();addOrUpdateDraftShift();return
 }
 const data=validatePlan();if(!data)return;const idx=state.plans.findIndex(x=>x.id===editingPlanId);if(idx<0){alert("That planned job could not be found.");resetNewForm();return}
 data.phaseMode=currentPhaseMode();if(data.phaseMode==="water"){data.irrigationOnly=true;data.injectors=emptyInjectorsForFarm(data.farm);data.fertigationFinishBefore=0}else data.irrigationOnly=false;
 data.shiftPumps=selectedShiftPumps();data.requiredPumps=data.shiftPumps.length?data.shiftPumps:data.requiredPumps;data.useIndividualValveRuntimes=$("useIndividualValveRuntimes").checked;data.individualValveRuntimes=getIndividualValveRuntimes();data.fertigationFinishBefore=data.phaseMode==="fertigation"?fertFinishMinutes():0;
 state.plans[idx]={...state.plans[idx],...data,updated:new Date().toISOString()};sortPlans();save();resetNewForm();renderPlan();showPage("tonight");alert("Job updated.")
}
function editDraftShift(i){const job=draftShifts()[i];if(!job)return;editingDraftShiftIndex=i;loadPlanToForm(job,false);renderProgramBanner();syncShiftMode();window.scrollTo({top:$("formTitle").getBoundingClientRect().top+window.scrollY-20,behavior:"smooth"})}
function removeDraftShift(i){const a=activeProgram(),job=draftShifts()[i];if(!a||!job)return;if(!confirm(`Remove Job ${i+1} from this draft program?`))return;a.draftShifts.splice(i,1);a.draftShifts.forEach((j,n)=>j.programSequence=n+1);applyFinalVatRinseToDraftJobs();save();editingDraftShiftIndex=-1;prepareNextShiftForm()}
function loadPlanToForm(p,isEdit){
 editingPlanId=isEdit?p.id:null;setEditMode(isEdit);$("nightDate").value=p.nightDate||p.date;$("date").value=p.date;$("startTime").value=p.startTime;$("timeDisplay").textContent=fmtTime(p.startTime);$("timeHint").textContent=isEdit?"Existing planned start":"Draft job";$("duration").value=p.hours;$("farm").value=p.farm;renderOutlets();$("pumpSystem").value=GROUP[p.farm]||"";$("outlets").querySelectorAll("input").forEach(x=>x.checked=(p.outlets||[]).includes(x.value));
 irrigationOnly=p.irrigationOnly===true;draftInjectionBeforeIrrigationOnly=irrigationOnly?rememberedInjectors(p.farm):null;renderInjectors(irrigationOnly?rememberedInjectors(p.farm):(p.injectors||[]));updateInjectionMode();$("notes").value=p.notes||"";
 $("shiftMode").value=p.phaseMode||((p.irrigationOnly===true)?"water":"fertigation");$("shiftPumps").value=(p.shiftPumps||p.requiredPumps||[]).join(", ");$("useIndividualValveRuntimes").checked=p.useIndividualValveRuntimes===true;renderIndividualValveRuntimes(p.individualValveRuntimes||{});
 const fb=Number(p.fertigationFinishBefore)||selectedOutletTravelMinutes();if($("fertFinishBefore")){if([30,45,60].includes(fb))$("fertFinishBefore").value=String(fb);else{$("fertFinishBefore").value="custom";if($("fertFinishCustom"))$("fertFinishCustom").value=fb;$("fertFinishCustomWrap")?.classList.remove("hidden")}}
 timeManuallyAdjusted=true;renderInlineVatMix();syncShiftMode();recalc();showPage("new")
}
function editPlan(id){const p=state.plans.find(x=>x.id===id);if(p)loadPlanToForm(p,true)}
function duplicatePlan(id){const p=state.plans.find(x=>x.id===id);if(!p)return;loadPlanToForm(p,false);editingPlanId=null;timeManuallyAdjusted=false;applySuggestedStart();alert("Copy loaded. Adjust the job details, then save it as a new job.")}

function inlineMixedProducts(){return state.fertilizers.filter(n=>{const m=productMetaFor(n);return m.method==="mixed"&&m.unit==="kg/ha"}).sort((a,b)=>a.localeCompare(b))}
function renderInlineVatMix(){
 const product=$("mixProduct"),injector=$("mixInjector"),box=$("mixOutlets"),batch=$("mixBatchName");if(!product||!injector||!box||!batch)return;
 const oldProduct=product.value,products=inlineMixedProducts();product.innerHTML=products.length?products.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join(""):'<option value="">No mixed kg/ha products</option>';
 if(products.includes(oldProduct))product.value=oldProduct;else if(products.includes("Calcium Nitrate"))product.value="Calcium Nitrate";
 const active=preparedVatForFarm($("farm").value);
 if(active&&products.includes(active.product))product.value=active.product;
 const farm=$("farm").value,cfg=state.injectorConfig[farm]||[],oldInj=injector.value;injector.innerHTML=cfg.map((x,i)=>`<option value="${i}">${esc(x.name||`Injector ${i+1}`)} — ${Number(x.flow)||0} L/min</option>`).join("");if(oldInj!==""&&Number(oldInj)<cfg.length)injector.value=oldInj;
 const checked=new Set([...box.querySelectorAll("input:checked")].map(x=>x.value));box.innerHTML="";
 outletEntries(farm).forEach(([o,ha])=>{const r=state.rotation[farm+"|"+o]||{status:"active"};if(r.status!=="active")return;const l=document.createElement("label");l.className="vatJob";l.innerHTML=`<input type="checkbox" value="${esc(o)}"><span><strong>${esc(o)}</strong><small>${ha.toFixed(2)} ha</small></span>`;const cb=l.querySelector("input");cb.checked=checked.has(o);cb.addEventListener("change",renderInlineVatSummary);box.appendChild(l)});
 const desired=`${farm} ${product.value||"Fertilizer"} Vat`;
 const appearsAuto=!batch.value.trim()||batch.dataset.autoName==="1"||Object.keys(FARMS).some(f=>batch.value===`${f} ${oldProduct||product.value||"Fertilizer"} Vat`)||Object.keys(FARMS).some(f=>batch.value===`${f} ${product.value||"Fertilizer"} Vat`);
 if(active){batch.value=active.batchName;batch.dataset.autoName="0";$("mixRate").value=active.rate;$("mixVolume").value=active.volume;if(injector.options[Number(active.injectorIndex)])injector.value=String(Number(active.injectorIndex));}
 else{if(appearsAuto){batch.value=desired;batch.dataset.autoName="1"}loadLastVatSettings()}
 renderInlineVatSummary();syncPreparedVatStatus()
}
function inlineVatSelectedOutlets(){return [...document.querySelectorAll("#mixOutlets input:checked")].map(x=>x.value)}
function inlineVatData(){const farm=$("farm").value,outs=inlineVatSelectedOutlets(),rate=Math.max(0,Number($("mixRate").value)||0),volume=Math.max(0,Number($("mixVolume").value)||0),totalArea=outs.reduce((s,o)=>s+(Number(FARMS[farm]?.[o])||0),0),totalKg=totalArea*rate,concentration=volume>0?totalKg/volume:0,current=selected().filter(o=>outs.includes(o)),currentArea=current.reduce((s,o)=>s+(Number(FARMS[farm]?.[o])||0),0),currentKg=currentArea*rate,currentSolution=totalArea>0?volume*(currentArea/totalArea):0;return{farm,outs,rate,volume,totalArea,totalKg,concentration,current,currentArea,currentKg,currentSolution}}
function renderInlineVatSummary(){const b=$("mixSummary");if(!b)return;const d=inlineVatData();if(!d.outs.length){b.innerHTML='<div class="muted">Select the outlets that will receive fertilizer from this vat.</div>';return}const alloc=d.outs.map(o=>{const ha=Number(FARMS[d.farm]?.[o])||0;return `${esc(o)}: ${(ha*d.rate).toFixed(1)} kg · ${(d.totalArea>0?d.volume*ha/d.totalArea:0).toFixed(1)} L`}).join("<br>");b.innerHTML=`<div class="vatCalcTop"><div class="vatMetric"><span>Selected area</span><strong>${d.totalArea.toFixed(2)} ha</strong></div><div class="vatMetric"><span>Product to dissolve</span><strong>${d.totalKg.toFixed(1)} kg</strong></div><div class="vatMetric"><span>Prepared vat</span><strong>${d.volume.toFixed(0)} L</strong></div><div class="vatMetric"><span>Concentration</span><strong>${d.concentration.toFixed(4)} kg/L</strong></div></div><div class="vatAllocation" style="margin-top:8px">${alloc}</div>${`<div class="note blue" style="margin-top:8px"><strong>Whole vat plan:</strong> ${d.totalKg.toFixed(1)} kg is allocated across the selected outlets by hectares. Planned prepared-solution balance after all selected outlets: <strong>0 L</strong>. Float-switch rinse water is not included.</div>`}`}
function applyInlineVatToShift(){
 const d=inlineVatData(),product=$("mixProduct").value,batch=$("mixBatchName").value.trim(),idx=Number($("mixInjector").value);
 if(!product||!d.outs.length||!(d.rate>0)||!(d.volume>0)){alert("Choose the mixed product, fertilizer outlets, target rate and vat volume first.");return}
 if(!d.current.length){alert("None of the currently selected job outlets are included in this vat mix.");return}
 if(!batch){alert("Enter a vat / batch name.");return}
 const card=document.querySelector(`.inj[data-index="${idx}"]`);if(!card){alert("That injection point could not be found.");return}
 // The Vat Mix Calculator is authoritative for this mixed product in this job.
 // Clear stale remembered duplicates of the same product on other injection points.
 document.querySelectorAll(".inj").forEach(other=>{
   if(other===card)return;
   const otherType=other.querySelector(".itype")?.value,otherName=other.querySelector(".iname")?.value||"";
   if(otherType==="product"&&String(otherName).trim().toLowerCase()===String(product).trim().toLowerCase()){
     other.querySelector(".itype").value="unused";
     other.dataset.vatBuilder="0";
     other.querySelector(".itype").dispatchEvent(new Event("change",{bubbles:true}));
   }
 });
 card.dataset.vatBuilder="1";
 card.querySelector(".itype").value="product";card.querySelector(".iname").value=product;card.querySelector(".irate").value=d.rate;card.querySelector(".iunit").value="kg/ha";card.querySelector(".ibatch").value=batch;card.querySelector(".isolution").value=Number(d.currentSolution.toFixed(1));
 const prior=draftShifts().some(p=>(p.injectors||[]).some(x=>x&&x.type==="product"&&x.name===product&&x.batchName===batch));
 card.querySelector(".ibatchmode").value=prior?"continue":"new";card.querySelector(".ibatchstart").value=prior?0:d.volume;
 card.querySelector(".itype").dispatchEvent(new Event("change",{bubbles:true}));recalc();

 // Make the calculator-applied injector setup the remembered setup immediately.
 // This prevents an older remembered Calcium Nitrate batch (for example "1500 / 950 L")
 // from returning if the form is refreshed/reset while building the night program.
 const remembered=injData().map(x=>({...x}));
 state.fertigationMemory[d.farm]=remembered;
 save();

 alert(`Applied this vat share to the current job.\n\n${d.current.join(", ")}\n${d.currentArea.toFixed(2)} ha\n${d.currentKg.toFixed(1)} kg target\n${d.currentSolution.toFixed(1)} L prepared solution`)
}
function vatMixedProducts(){return state.fertilizers.filter(n=>{const m=productMetaFor(n);return m.method==="mixed"&&m.unit==="kg/ha"}).sort((a,b)=>a.localeCompare(b))}
function vatSelectedPlanIds(){return [...document.querySelectorAll("#vatJobs input:checked")].map(x=>x.value)}
function vatSelectedPlans(){const ids=new Set(vatSelectedPlanIds());return plansForDate($("planViewDate").value||today()).filter(p=>ids.has(p.id)).sort((a,b)=>dtValue(a.date,a.startTime)-dtValue(b.date,b.startTime))}
function vatFarmPlans(){const date=$("planViewDate").value||today(),farm=$("vatFarm")?.value||"";return plansForDate(date).filter(p=>p.farm===farm)}
function vatInjectorConfig(){const f=$("vatFarm")?.value||"",idx=Number($("vatInjector")?.value);return state.injectorConfig[f]?.[idx]||defaultInjector(idx||0)}
function vatCalcData(){
 const plans=vatSelectedPlans(),rate=Number($("vatRate")?.value)||0,volume=Number($("vatVolume")?.value)||0,cfg=vatInjectorConfig(),flow=Number(cfg.flow)||0;
 const totalArea=plans.reduce((s,p)=>s+(Number(p.area)||0),0),totalKg=totalArea*rate,concentration=volume>0?totalKg/volume:0;
 const rows=plans.map(p=>{
   const area=Number(p.area)||0,productKg=area*rate,solutionL=totalArea>0?volume*(area/totalArea):0,exactRuntime=flow>0?solutionL/flow:0,runtime=flow>0?Math.ceil(exactRuntime):0;
   const outletAllocations=(p.outlets||[]).map(o=>{const ha=Number(FARMS[p.farm]?.[o])||0;return{outlet:o,ha,productKg:Number((ha*rate).toFixed(4)),solutionL:Number((totalArea>0?volume*(ha/totalArea):0).toFixed(4)),rateKgHa:rate}});
   return{p,area,productKg,solutionL,exactRuntime,runtime,outletAllocations};
 });
 return{plans,rate,volume,cfg,flow,totalArea,totalKg,concentration,rows}
}
function renderVatBuilder(){
 const farmSel=$("vatFarm"),prodSel=$("vatProduct"),injSel=$("vatInjector"),jobsBox=$("vatJobs"),summary=$("vatSummary");if(!farmSel||!prodSel||!injSel||!jobsBox||!summary)return;
 const date=$("planViewDate").value||today(),nightPlans=plansForDate(date),currentFarm=farmSel.value;
 const farms=[...new Set(nightPlans.map(p=>p.farm))];
 if(!farms.length){farmSel.innerHTML='<option value="">No planned farms</option>';prodSel.innerHTML='<option value="">No products</option>';injSel.innerHTML='<option value="">No injector</option>';jobsBox.innerHTML='<div class="empty" style="grid-column:1/-1">Add irrigation jobs to Tonight’s Plan first, then build the shared vat.</div>';summary.innerHTML='<div class="muted">No planned jobs available for this night.</div>';return}
 farmSel.innerHTML=farms.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join("");
 if(currentFarm&&farms.includes(currentFarm))farmSel.value=currentFarm;
 const products=vatMixedProducts(),currentProduct=prodSel.value;
 prodSel.innerHTML=products.length?products.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join(""):'<option value="">No mixed kg/ha products in Setup</option>';
 if(products.includes("Calcium Nitrate"))prodSel.value="Calcium Nitrate";else if(currentProduct&&products.includes(currentProduct))prodSel.value=currentProduct;
 const cfg=state.injectorConfig[farmSel.value]||[],currentInjector=injSel.value;
 injSel.innerHTML=cfg.map((x,i)=>`<option value="${i}">${esc(x.name||`Injector ${i+1}`)} — ${Number(x.flow)||0} L/min</option>`).join("");
 if(currentInjector!==""&&Number(currentInjector)<cfg.length)injSel.value=currentInjector;
 const farmPlans=vatFarmPlans().filter(p=>(p.phaseMode||((p.irrigationOnly===true)?"water":"fertigation"))==="fertigation"),checkedBefore=new Set(vatSelectedPlanIds());
 jobsBox.innerHTML="";
 if(!farmPlans.length){jobsBox.innerHTML='<div class="empty" style="grid-column:1/-1">No jobs for this farm on the selected night.</div>'}
 farmPlans.forEach(p=>{const l=document.createElement("label");l.className="vatJob";l.innerHTML=`<input type="checkbox" value="${esc(p.id)}"><span><strong>${fmtTime(p.startTime)} — ${esc(p.outlets.join(", "))}</strong><small>${Number(p.area||0).toFixed(2)} ha · ${Number(p.hours||0).toLocaleString("en-AU",{maximumFractionDigits:2})} hr irrigation</small></span>`;const cb=l.querySelector("input");cb.checked=checkedBefore.has(p.id);cb.addEventListener("change",renderVatSummary);jobsBox.appendChild(l)});
 renderVatSummary()
}
function renderVatSummary(){
 const b=$("vatSummary");if(!b)return;const d=vatCalcData(),batch=$("vatBatchName")?.value.trim()||"Shared Vat";
 if(!d.plans.length){b.innerHTML='<div class="muted">Select the planned jobs that will draw from this vat.</div>';return}
 const flowOK=d.flow>0,volumeOK=d.volume>0,rateOK=d.rate>0;
 let rows=d.rows.map(r=>`<tr><td><strong>${fmtTime(r.p.startTime)}</strong><br>${esc(r.p.farm)} — ${r.p.outlets.map(esc).join(", ")}</td><td>${r.area.toFixed(2)} ha</td><td><strong>${r.productKg.toFixed(2)} kg</strong><div class="vatAllocation">${r.outletAllocations.map(a=>`${esc(a.outlet)} ${Number(a.productKg).toLocaleString("en-AU",{maximumFractionDigits:2})} kg`).join(" · ")}</div></td><td>${r.solutionL.toFixed(1)} L</td><td>${flowOK?`${r.exactRuntime.toFixed(2)} min → <strong>${r.runtime} min</strong>`:"Enter injector flow in Setup"}</td></tr>`).join("");
 const roundedPumped=d.rows.reduce((s,r)=>s+(flowOK?r.runtime*d.flow:0),0),roundingVariance=roundedPumped-d.volume;
 b.innerHTML=`<div class="vatCalcTop"><div class="vatMetric"><span>Selected area</span><strong>${d.totalArea.toFixed(2)} ha</strong></div><div class="vatMetric"><span>Product to mix</span><strong>${d.totalKg.toFixed(2)} kg</strong></div><div class="vatMetric"><span>Vat solution</span><strong>${d.volume.toLocaleString("en-AU",{maximumFractionDigits:1})} L</strong></div><div class="vatMetric"><span>Batch concentration</span><strong>${d.concentration.toFixed(4)} kg/L</strong></div></div><div class="vatTableWrap"><table class="vatTable"><thead><tr><th>Planned job</th><th>Area</th><th>Calcium / product allocation</th><th>Solution allocation</th><th>AquaLink Runtime</th></tr></thead><tbody>${rows}</tbody></table></div>${flowOK&&Math.abs(roundingVariance)>0.01?`<div class="vatWarning"><strong>Whole-minute Runtime note:</strong> the exact area-based solution allocations total ${d.volume.toFixed(1)} L. Because AquaLink Runtime is rounded up to whole minutes, the displayed runtimes represent about ${roundedPumped.toFixed(1)} L at ${d.flow} L/min (${roundingVariance>=0?"+":""}${roundingVariance.toFixed(1)} L versus the exact allocation). The kg figures above remain the target allocation by hectares.</div>`:""}<div class="muted" style="margin-top:9px"><strong>${esc(batch)}</strong> · ${esc($("vatProduct")?.value||"Product")} at ${d.rate} kg/ha. Irrigation hours do not determine fertilizer share; hectares do.</div>`;
}
function relinkStoredPlanPreflows(p,preferredFirstPreflow=0,vatPhysicalIndex=null){
 const active=orderedInjectors(p.injectors);let previous=null;
 active.forEach((x,pos)=>{if(pos===0){if(x.physicalIndex===vatPhysicalIndex&&!x.preflowManual)x.preflow=Math.max(0,Math.round(Number(preferredFirstPreflow)||0))}else if(!x.preflowManual&&previous)x.preflow=Math.max(0,Math.round((Number(previous.preflow)||0)+(Number(previous.runtime)||0)));previous=x})
}
function applyVatBatchToPlans(){
 const d=vatCalcData(),farm=$("vatFarm").value,product=$("vatProduct").value,batchName=$("vatBatchName").value.trim(),physicalIndex=Number($("vatInjector").value),firstPreflow=Math.max(0,Math.round(Number($("vatPreflow").value)||0));
 if(!d.plans.length){alert("Select at least one planned irrigation job for this vat.");return}
 if(!product){alert("Choose the mixed product for the vat.");return}
 if(!(d.rate>0)){alert("Enter the target product rate in kg/ha.");return}
 if(!(d.volume>0)){alert("Enter the prepared vat volume in litres.");return}
 if(!batchName){alert("Enter a vat / batch name.");return}
 if(!(d.flow>0)){alert(`Enter the flow rate for ${d.cfg.name||"this injector"} in Setup before building the vat.`);return}
 if(!confirm(`Build ${batchName} across ${d.plans.length} planned job${d.plans.length===1?"":"s"}?\n\nMix ${d.totalKg.toFixed(2)} kg of ${product} into ${d.volume.toFixed(1)} L prepared solution.\n\nThis will update the selected jobs on Tonight's Plan.`))return;
 d.rows.forEach((r,rowIndex)=>{
   const p=state.plans.find(x=>x.id===r.p.id);if(!p)return;
   migratePlan(p);
   const cfg=state.injectorConfig[farm]?.[physicalIndex]||defaultInjector(physicalIndex),existing=p.injectors[physicalIndex]||{};
   const wasUnused=!existing||existing.type==="unused";
   const sequenceOrder=Number.isFinite(Number(existing.sequenceOrder))?Number(existing.sequenceOrder):physicalIndex;
   p.irrigationOnly=false;
   p.injectors[physicalIndex]={
     ...existing,
     type:"product",physicalIndex,sequenceOrder,
     injectorName:cfg.name||`Injector ${physicalIndex+1}`,
     flow:Number(cfg.flow)||0,flowUnit:"L/min",
     name:product,rate:d.rate,unit:"kg/ha",qty:Number(r.productKg.toFixed(4)),injectionMethod:"mixed",
     batchMode:rowIndex===0?"new":"continue",batchName,batchStartAmount:rowIndex===0?Number(d.volume.toFixed(4)):0,
     solutionVolume:Number(r.solutionL.toFixed(4)),
     runtime:r.runtime,calculatedRuntime:Number(r.exactRuntime.toFixed(4)),runtimeManual:false,
     preflow:wasUnused?0:(Number(existing.preflow)||0),preflowManual:false,
     flushRuntime:0,flushNote:"",
     outletAllocations:r.outletAllocations,vatBuilder:true
   };
   relinkStoredPlanPreflows(p,firstPreflow,physicalIndex);
   p.updated=new Date().toISOString();
 });
 const mem=copyInjectionSetup(state.plans.find(p=>p.id===d.rows[0].p.id)?.injectors||[]);
 mem.forEach(x=>{if(x&&x.type==="product"&&x.batchName&&(x.batchMode==="new"||x.batchMode==="continue")){x.batchMode="continue";x.batchStartAmount=0}});
 state.fertigationMemory[farm]=mem;
 sortPlans();save();renderPlan();
 alert(`Vat batch applied.\n\n${d.totalKg.toFixed(2)} kg ${product}\n${d.volume.toFixed(1)} L prepared solution\n${d.totalArea.toFixed(2)} ha total\n\nEach selected job now has its area-based solution allocation and AquaLink Runtime.`);
}
