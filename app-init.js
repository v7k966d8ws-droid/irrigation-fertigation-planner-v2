function network(){const online=navigator.onLine;$("network").className="pill "+(online?"on":"off");$("network").textContent=online?"● Online":"● Offline — planner still works"}window.addEventListener("online",network);window.addEventListener("offline",network);

$("startProgram").addEventListener("click",startIrrigationProgram);
$("saveNightProgram").addEventListener("click",saveNightProgram);
if($("saveNightProgramBottom")) $("saveNightProgramBottom").addEventListener("click",saveNightProgram);
$("cancelProgram").addEventListener("click",cancelIrrigationProgram);
$("programName").addEventListener("input",()=>{const a=activeProgram();if(a){a.name=$("programName").value.trim()||a.name;save();renderProgramBanner()}else $("programName").dataset.autoName="0"});
$("shiftMode").addEventListener("change",syncShiftMode);$("vatRequired").addEventListener("change",()=>{syncVatRequirementUI();if(vatRequired())renderInlineVatMix()});
$("pumpSetupFarm").addEventListener("change",renderPumpSetup);
$("addPump").addEventListener("click",addPump);
$("mixProduct").addEventListener("change",()=>{$("mixBatchName").value=`${$("farm").value} ${$("mixProduct").value||"Fertilizer"} Vat`;$("mixBatchName").dataset.autoName="1";loadLastVatSettings();renderInlineVatSummary()});
["mixRate","mixVolume"].forEach(id=>$(id).addEventListener("input",renderInlineVatSummary));$("mixBatchName").addEventListener("input",()=>{$("mixBatchName").dataset.autoName="0";renderInlineVatSummary()});
$("mixInjector").addEventListener("change",renderInlineVatSummary);
$("applyMixToShift").addEventListener("click",prepareVatMix);
$("preparedVatStatus").addEventListener("click",e=>{
 const btn=e.target.closest("#toggleVatPrepareDetails");if(!btn)return;
 vatPrepareExpanded=!vatPrepareExpanded;
 syncVatRequirementUI();
 if(vatPrepareExpanded)renderInlineVatSummary();
});
$("farm").addEventListener("change",()=>setTimeout(()=>{syncShiftMode();renderInlineVatMix();updateDefaultProgramName()},0));
$("usePumpRule").addEventListener("click",useSavedPumpRule);
$("useIndividualValveRuntimes").addEventListener("change",()=>renderIndividualValveRuntimes());
$("outlets").addEventListener("change",()=>{renderIndividualValveRuntimes();renderInlineVatSummary();applyPreparedVatToCurrentJob(true);syncPreparedVatStatus();syncPreparedVatOutletChoices()});
$("duration").addEventListener("input",()=>renderIndividualValveRuntimes(getIndividualValveRuntimes()));
if($("fertFinishBefore"))$("fertFinishBefore").addEventListener("change",()=>{$("fertFinishCustomWrap")?.classList.toggle("hidden",$("fertFinishBefore").value!=="custom")});
$("calculateFertTiming").addEventListener("click",autoFertigationPreflow);
$("savePlan").addEventListener("click",savePlan);$("irrigationOnlyBtn").addEventListener("click",toggleIrrigationOnly);$("clearForm").addEventListener("click",resetNewForm);$("cancelEdit").addEventListener("click",()=>{resetNewForm();showPage("tonight")});$("exportCsv").addEventListener("click",exportCsv);$("clearHistory").addEventListener("click",clearHistory);$("vatFarm").addEventListener("change",renderVatBuilder);
$("vatProduct").addEventListener("change",renderVatSummary);
$("vatInjector").addEventListener("change",renderVatSummary);
["vatBatchName","vatRate","vatVolume","vatPreflow"].forEach(id=>$(id).addEventListener("input",renderVatSummary));
$("applyVatBatch").addEventListener("click",applyVatBatchToPlans);
$("copyFieldInstructions").addEventListener("click",copyFieldInstructions);
$("planViewDate").addEventListener("change",()=>{renderPlan();if(!editingPlanId){$("nightDate").value=$("planViewDate").value;timeManuallyAdjusted=false;applySuggestedStart()}});$("copyProgram").addEventListener("click",copyProgram);$("viewProgramTime").addEventListener("click",()=>{programViewMode="time";$("viewProgramTime").className="primary";$("viewProgramFarm").className="secondary";renderProgram(plansForDate($("planViewDate").value||today()))});
$("viewProgramFarm").addEventListener("click",()=>{programViewMode="farm";$("viewProgramFarm").className="primary";$("viewProgramTime").className="secondary";renderProgram(plansForDate($("planViewDate").value||today()))});$("duration").addEventListener("input",finishText);$("date").addEventListener("change",finishText);$("nightDate").addEventListener("change",()=>{if(!editingPlanId){timeManuallyAdjusted=false;applySuggestedStart();updateDefaultProgramName()}});document.querySelectorAll(".compactTimePicker button[data-min]").forEach(b=>b.addEventListener("click",()=>shiftStart(Number(b.dataset.min))));$("useSuggested").addEventListener("click",()=>{timeManuallyAdjusted=false;applySuggestedStart()});$("addProduct").addEventListener("click",addProduct);$("newProductMethod").addEventListener("change",()=>{if($("newProductMethod").value==="direct")$("newProductUnit").value="L/ha"});$("newProduct").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();addProduct()}});$("addPumpRule").addEventListener("click",addPumpRule);
$("planViewDate").value=today();$("nightDate").value=today();$("date").value=today();farmInit();updateDefaultProgramName(true);renderInlineVatMix();applySuggestedStart();syncShiftMode();renderProgramBanner();populateFarmFilters();dashboard();history();setup();renderPlan();network();

// Compact duration selector. Keep the original numeric #duration value as the
// calculation source so existing finish-time, preflow and save logic is unchanged.
(function initCompactDurationControl(){
 const duration=$('duration'),picker=$('durationPicker');
 if(!duration||!picker)return;
 function nearestPickerValue(hours){
   const values=[...picker.options].map(o=>Number(o.value));
   return values.reduce((a,b)=>Math.abs(b-hours)<Math.abs(a-hours)?b:a,values[0]);
 }
 function syncPicker(){
   const h=Math.max(.25,Number(duration.value)||4);
   picker.value=String(nearestPickerValue(h));
 }
 function setDuration(hours){
   const h=Math.max(.25,Math.min(24,Math.round(Number(hours)*4)/4));
   duration.value=String(h);
   syncPicker();
   duration.dispatchEvent(new Event('input',{bubbles:true}));
 }
 picker.addEventListener('change',()=>setDuration(Number(picker.value)));
 document.querySelectorAll('[data-duration-min]').forEach(btn=>btn.addEventListener('click',()=>setDuration((Number(duration.value)||4)+(Number(btn.dataset.durationMin)||0)/60)));
 duration.addEventListener('input',syncPicker);
 syncPicker();
})();
