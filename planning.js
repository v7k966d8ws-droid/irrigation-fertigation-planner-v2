function savePlan(){
 const data=validatePlan();if(!data)return;
 const wasEdit=!!editingPlanId,a=activeProgram(),phaseMode=a?currentPhaseMode():(data.irrigationOnly?"water":"fertigation");
 data.phaseMode=phaseMode;
 if(a&&phaseMode==="water"){data.irrigationOnly=true;data.injectors=emptyInjectorsForFarm(data.farm)}
 if(a&&phaseMode==="fertigation"){data.irrigationOnly=false;data.requiredPumps=["Single fertigation-capable site pump"]}
 if(a&&!wasEdit){
   if(data.farm!==a.farm){alert(`This program is for ${a.farm}. Choose ${a.farm} for this set, or finish the current program first.`);return}
   if(data.nightDate!==a.nightDate){alert(`This program is for the night of ${a.nightDate}. Use that night plan date, or finish the current program first.`);return}
   data.programId=a.id;data.programName=a.name;data.programSequence=nextProgramSequence()
 }
 if(editingPlanId){
   const idx=state.plans.findIndex(x=>x.id===editingPlanId);
   if(idx<0){alert("That planned job could not be found.");resetNewForm();return}
   state.plans[idx]={...state.plans[idx],...data,updated:new Date().toISOString()}
 }else state.plans.push({id:uid(),...data,created:new Date().toISOString()});
 if(data.phaseMode==="fertigation"&&hasProductInjection(data.injectors)){
   const mem=copyInjectionSetup(data.injectors);
   mem.forEach(x=>{if(x&&x.type==="product"&&x.batchName&&(x.batchMode==="new"||x.batchMode==="continue")){x.batchMode="continue";x.batchStartAmount=0}});
   state.fertigationMemory[data.farm]=mem
 }
 sortPlans();save();$("planViewDate").value=data.nightDate;
 const setNo=data.programSequence||0;
 resetNewForm();renderPlan();renderProgramBanner();
 if(a&&!wasEdit){showPage("new");alert(`Set ${setNo} saved to ${a.name}.\n\nThe next start time has been suggested after this set finishes. Choose the next outlet or outlet combination, then choose Water Only or Fertigation.`)}
 else{showPage("tonight");alert(wasEdit?"Planned job updated.":data.irrigationOnly?"Irrigation-only job added. Your last fertigation setup is still remembered.":"Added to the night plan. Fertigation setup remembered for this farm.")}
}
function loadPlanToForm(p,isEdit){editingPlanId=isEdit?p.id:null;setPhaseMode(p.phaseMode||((p.irrigationOnly===true)?"water":"fertigation"));setEditMode(isEdit);$("nightDate").value=p.nightDate||p.date;$("date").value=p.date;$("startTime").value=p.startTime;$("timeDisplay").textContent=fmtTime(p.startTime);$("timeHint").textContent=isEdit?"Existing planned start":"Copied job — suggested next start can be restored";$("duration").value=p.hours;$("farm").value=p.farm;renderOutlets();$("pumpSystem").value=GROUP[p.farm]||"";$("outlets").querySelectorAll("input").forEach(x=>x.checked=p.outlets.includes(x.value));irrigationOnly=p.irrigationOnly===true;draftInjectionBeforeIrrigationOnly=irrigationOnly?rememberedInjectors(p.farm):null;renderInjectors(irrigationOnly?rememberedInjectors(p.farm):(p.injectors||[]));updateInjectionMode();$("notes").value=p.notes||"";timeManuallyAdjusted=true;recalc();showPage("new");window.scrollTo({top:0,behavior:"smooth"})}
function editPlan(id){const p=state.plans.find(x=>x.id===id);if(p)loadPlanToForm(p,true)}
function duplicatePlan(id){const p=state.plans.find(x=>x.id===id);if(!p)return;loadPlanToForm(p,false);timeManuallyAdjusted=false;applySuggestedStart();alert("Copy loaded. The start time has been suggested after the latest job on this pump system. Adjust it if needed, then save as a new job.")}
function plansForDate(date){return state.plans.filter(p=>(p.nightDate||p.date)===date).sort((a,b)=>dtValue(a.date,a.startTime)-dtValue(b.date,b.startTime))}
function orderedInjectors(items){return (items||[]).filter(x=>x&&x.type!=="unused").slice().sort((a,b)=>(Number(a.sequenceOrder)||0)-(Number(b.sequenceOrder)||0))}


function activeProgram(){return state.activeProgram&&state.activeProgram.id?state.activeProgram:null}
function activeProgramPlans(){const a=activeProgram();return a?state.plans.filter(p=>p.programId===a.id).sort((x,y)=>(Number(x.programSequence)||0)-(Number(y.programSequence)||0)):[]}
function nextProgramSequence(){const arr=activeProgramPlans();return arr.length?Math.max(...arr.map(p=>Number(p.programSequence)||0))+1:1}
function startIrrigationProgram(){
 const existing=activeProgram();
 if(existing&&!confirm(`A program is already active: ${existing.name}. Finish it and start a new one?`))return;
 const farm=$("farm").value,nightDate=$("nightDate").value||today(),name=$("programName").value.trim()||`${farm} Night Program`;
 state.activeProgram={id:uid(),name,farm,nightDate,created:new Date().toISOString()};setPhaseMode("water");
 $("planViewDate").value=nightDate;
 save();renderProgramBanner();renderPlan();
 alert(`${name} started.\n\nEnter Set 1 below and save it normally.`);
}
function finishIrrigationProgram(){
 const a=activeProgram();
 if(!a){alert("There is no active irrigation program.");return}
 const sets=activeProgramPlans();
 if(!confirm(`Finish ${a.name}?\n\n${sets.length} set${sets.length===1?"":"s"} are saved in Tonight's Plan.`))return;
 state.activeProgram=null;save();renderProgramBanner();renderPlan();showPage("tonight")
}
function renderProgramBanner(){
 const a=activeProgram(),banner=$("programBanner"),txt=$("programStatusText"),pill=$("programStepPill"),name=$("programName");
 if(!banner||!txt||!pill||!name)return;
 if(!a){
   syncPhaseMode();
   banner.classList.remove("active");
   pill.textContent="No active program";
   txt.textContent="Start one farm program, then save each AquaLink irrigation set in sequence.";
   if(!name.value)name.value=($("farm").value||"Farm")+" Night Program";
   return
 }
 banner.classList.add("active");
 syncPhaseMode();
 name.value=a.name;
 const sets=activeProgramPlans(),last=sets[sets.length-1];
 pill.textContent=`Next: Set ${nextProgramSequence()}`;
 txt.innerHTML=`<strong>${esc(a.name)}</strong> · ${esc(a.farm)} · night of ${esc(a.nightDate)} · ${sets.length} saved set${sets.length===1?"":"s"}${last?` · previous set finishes ${fmtTime(last.finishTime)}`:""}`;
}
function currentPhaseMode(){return document.querySelector('input[name="programPhaseMode"]:checked')?.value||"water"}
function setPhaseMode(mode){const el=document.querySelector(`input[name="programPhaseMode"][value="${mode==="fertigation"?"fertigation":"water"}"]`);if(el)el.checked=true;syncPhaseMode()}
function syncPhaseMode(){
 const mode=currentPhaseMode(),help=$("phaseRuleHelp"),btn=$("irrigationOnlyBtn"),a=activeProgram();
 if(help)help.innerHTML=mode==="water"?"<strong>Water Only:</strong> multiple pumps/outlets may run together. No fertilizer is saved for this set.":"<strong>Fertigation:</strong> use the single fertigation-capable pump. Only select the outlet group that pump can irrigate together.";
 if(a){
   if(mode==="water"&&!irrigationOnly){draftInjectionBeforeIrrigationOnly=injData();irrigationOnly=true;updateInjectionMode()}
   if(mode==="fertigation"&&irrigationOnly){irrigationOnly=false;const restore=draftInjectionBeforeIrrigationOnly&&draftInjectionBeforeIrrigationOnly.length?draftInjectionBeforeIrrigationOnly:rememberedInjectors($("farm").value);draftInjectionBeforeIrrigationOnly=null;renderInjectors(restore);updateInjectionMode();recalc()}
   if(btn)btn.disabled=true
 }else if(btn)btn.disabled=false
}
function totalProgramWaterByOutlet(programId){const totals={};state.plans.filter(p=>p.programId===programId).forEach(p=>(p.outlets||[]).forEach(o=>{const k=p.farm+"|"+o;totals[k]=(totals[k]||0)+(Number(p.hours)||0)}));return totals}
function programInjectionSummary(p){
 if(p.irrigationOnly)return "Irrigation only";
 const xs=orderedInjectors(p.injectors);
 if(!xs.length)return "No injection actions";
 return xs.map(x=>x.type==="flush"?`${esc(x.injectorName||"Injector")} — Flush ${Math.round(Number(x.runtime)||0)} min`:`<strong>${esc(x.injectorName||"Injector")}</strong> — ${esc(x.name||"Product")} · Runtime ${Math.round(Number(x.runtime)||0)} min · Preflow ${Math.round(Number(x.preflow)||0)} min`).join(" · ")
}
function renderProgramList(){
 const host=$("programList");if(!host)return;
 const date=$("planViewDate").value||today(),ps=plansForDate(date),ids=[...new Set(ps.filter(p=>p.programId).map(p=>p.programId))];
 host.innerHTML="";
 if(!ids.length){host.innerHTML='<div class="empty">No sequential irrigation programs saved for this night.</div>';return}
 ids.forEach(id=>{
   const sets=ps.filter(p=>p.programId===id).sort((a,b)=>(Number(a.programSequence)||0)-(Number(b.programSequence)||0));
   const first=sets[0],last=sets[sets.length-1],card=document.createElement("div");card.className="programCard";
   const totals=totalProgramWaterByOutlet(id),totalText=Object.entries(totals).map(([k,h])=>`${esc(k.split("|")[1])}: ${Number(h).toLocaleString("en-AU",{maximumFractionDigits:2})} hr`).join(" · ");
   card.innerHTML=`<div class="programCardHead"><div><strong>${esc(first.programName||first.farm+" Program")}</strong><div class="muted">${esc(first.farm)} · ${sets.length} set${sets.length===1?"":"s"} · ${fmtTime(first.startTime)} → ${fmtTime(last.finishTime)}${last.finishDate!==first.date?" next day":""}</div>${totalText?`<div class="totalWaterBox"><strong>Total programmed irrigation by outlet:</strong> ${totalText}</div>`:""}</div><span class="programPill">AquaLink sequence</span></div><div style="margin-top:8px">${sets.map(p=>`<div class="programSetRow"><div class="programSetNo">Set ${Number(p.programSequence)||"?"}</div><div><strong>${esc(p.farm)} — ${p.outlets.map(esc).join(", ")}</strong><div class="muted">${Number(p.area||0).toFixed(2)} ha</div><div class="programSetInj">${programInjectionSummary(p)}</div></div><div><strong>${fmtTime(p.startTime)}</strong><div class="muted">${Number(p.hours||0).toLocaleString("en-AU",{maximumFractionDigits:2})} hr</div></div><div>${(p.phaseMode||((p.irrigationOnly===true)?"water":"fertigation"))==="water"?'<span class="phaseBadge water">Water Only</span>':'<span class="phaseBadge fert">Fertigation</span>'}</div></div>`).join("")}</div>`;
   host.appendChild(card)
 })
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
