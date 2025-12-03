/* app.js - Lógica principal (localStorage, hash, CRUD simples) */

/* --------- UTILIDADES --------- */
const STORAGE_KEY = 'so_monolito_v2';
function loadStore(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} }catch(e){return {}} }
function saveStore(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6) }
function q(id){ return document.getElementById(id) }

/* SHA-256 em hex */
async function sha256hex(text){
const enc = new TextEncoder().encode(text);
const digest = await crypto.subtle.digest('SHA-256', enc);
return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

/* --------- BOOTSTRAP (usuários demo, estrutura inicial) --------- */
let store = loadStore();
if(!store.users || store.users.length===0){
(async ()=>{
const a = await sha256hex('admin123');
const b = await sha256hex('dent123');
const c = await sha256hex('sec123');
store.users = [
{id:uid(), login:'admin', name:'Administrador', passHash:a, role:'admin'},
{id:uid(), login:'dentista', name:'Dr. Demo', passHash:b, role:'dentist'},
{id:uid(), login:'secretaria', name:'Secretaria', passHash:c, role:'secretary'}
];
store.patients = [];
store.records = [];
store.appointments = [];
store.payments = [];
store.reminders = [];
store.logs = [];
saveStore(store);
})();
}

/* --------- ESTADO DA SESSÃO --------- */
let currentUser = null;

/* --------- INICIALIZAÇÃO UI --------- */
document.addEventListener('DOMContentLoaded', ()=>{
// login handlers
q('btnLogin').addEventListener('click', onLogin);
q('btnDemo').addEventListener('click', ()=> autoLogin('dentista'));
q('btnLogout').addEventListener('click', ()=> location.reload());

// menu navigation
document.querySelectorAll('.menu button[data-view]').forEach(b=>{
b.addEventListener('click', ()=> showView(b.dataset.view));
});

// patient handlers
q('patientForm').addEventListener('submit', onSavePatient);
q('btnClearPatient').addEventListener('click', ()=> q('patientForm').reset());
q('btnSearchPatient').addEventListener('click', renderPatients);
q('btnExportPatients').addEventListener('click', ()=> exportCSV('patients'));

// records
q('btnAddRecord').addEventListener('click', addRecord);
q('btnSearchRecords').addEventListener('click', renderRecords);

// appointments
q('apptForm').addEventListener('submit', onSaveAppt);
q('btnViewDay').addEventListener('click', ()=> {
const date = q('agendaDate').value;
const dentist = q('agendaDentist').value;
renderAgendaDay(date, dentist);
});
q('btnExportAppts').addEventListener('click', ()=> exportCSV('appointments'));

// payments
q('payForm').addEventListener('submit', onSavePayment);

// reports
q('btnReportRevenue').addEventListener('click', reportRevenue);
q('btnReportPatients').addEventListener('click', reportPatients);
q('btnExportAll').addEventListener('click', exportAllCSV);

// users
q('btnCreateUser').addEventListener('click', onCreateUser);

// initial view
showView('dashboard');
renderDashboard();
periodicReminderChecker();
});

/* --------- AUTH --------- */
async function onLogin(){
const login = q('loginUser').value.trim();
const pass = q('loginPass').value;
if(!login||!pass){ alert('Preencha usuário e senha'); return; }
const h = await sha256hex(pass);
store = loadStore();
const u = store.users.find(x=>x.login===login && x.passHash===h);
if(u){ currentUser = u; afterLogin(); addLog('login', {login:u.login}); }
else alert('Usuário ou senha incorretos');
}
async function autoLogin(login){ store = loadStore(); const u = store.users.find(x=>x.login===login); if(u){ currentUser=u; afterLogin(); addLog('login_demo',{login}); } }

function afterLogin(){
q('loginCard').classList.add('hidden');
q('app').classList.remove('hidden');
q('who').textContent = `${currentUser.name} (${currentUser.role})`;
renderDashboard(); renderPatients(); renderPatientSelects(); renderUsersArea(); renderAgendaDentists(); renderPayments();
}

/* --------- LOG (auditoria) --------- */
function addLog(action, details){
store = loadStore();
store.logs = store.logs || [];
store.logs.push({id:uid(), time: new Date().toISOString(), user: currentUser?currentUser.login:'anon', action, details});
if(store.logs.length>500) store.logs.shift();
saveStore(store);
renderUsersArea(); // updates logs view when open
}

/* --------- VIEWS HELP --------- */
function showView(name){
document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
q(name).classList.remove('hidden');
if(name==='patients') renderPatients();
if(name==='records') renderRecords();
if(name==='agenda') renderAgendaDay(new Date().toISOString().slice(0,10), q('agendaDentist').value);
if(name==='finance') renderPayments();
if(name==='reports') renderDashboard();
}

/* --------- PATIENTS CRUD --------- */
function onSavePatient(e){
e.preventDefault();
store = loadStore();
const p = {
id: uid(),
name: q('p_name').value.trim(),
phone: q('p_phone').value.trim(),
email: q('p_email').value.trim(),
address: q('p_address').value.trim(),
dob: q('p_dob').value,
cpf: q('p_cpf').value.trim(),
allergies: q('p_allergies').value.trim(),
notes: q('p_notes').value.trim(),
createdAt: new Date().toISOString()
};
if(!p.name){ alert('Nome obrigatório'); return; }
store.patients = store.patients || [];
store.patients.push(p);
saveStore(store);
addLog('create_patient', {id:p.id, name:p.name});
q('patientForm').reset();
renderPatients();
renderPatientSelects();
}

function renderPatients(){
store = loadStore();
const qv = q('searchPatient').value.trim().toLowerCase();
const list = store.patients || [];
const out = [];
list.filter(p=> !qv || (p.name+p.cpf+p.email).toLowerCase().includes(qv)).forEach(p=>{
out.push(renderPatientItem(p));
});
q('patientsList').innerHTML = out.join('');
}

function renderPatientItem(p){
return `<div class="item"> <b>${p.name}</b> <small>${p.cpf||''}</small><br>
${p.phone||''} • ${p.email||''}<br>
${p.address? p.address + ' • ' : ''} ${p.dob? 'nasc: '+p.dob : ''}<br> <small>${p.allergies? 'Alergias: '+p.allergies : ''}</small><br> <div class="actions"> <button onclick="viewPatient('${p.id}')">Ver / Prontuário</button> <button onclick="editPatient('${p.id}')" class="secondary">Editar</button> <button onclick="deletePatient('${p.id}')" class="danger">Excluir</button> </div>

  </div>`;
}

function deletePatient(id){
if(!confirm('Excluir paciente?')) return;
store = loadStore();
store.patients = (store.patients||[]).filter(x=>x.id!==id);
// remove related records/appointments/payments
store.records = (store.records||[]).filter(r=>r.patientId!==id);
store.appointments = (store.appointments||[]).filter(a=>a.patientId!==id);
store.payments = (store.payments||[]).filter(p=>p.patientId!==id);
saveStore(store);
addLog('delete_patient', {id});
renderPatients(); renderPatientSelects(); renderAgendaDay(new Date().toISOString().slice(0,10));
}

function editPatient(id){
const p = (loadStore().patients||[]).find(x=>x.id===id);
if(!p) return alert('Paciente não encontrado');
// preenche form para edição simples (substitui criação)
q('p_name').value = p.name; q('p_phone').value = p.phone; q('p_email').value = p.email;
q('p_address').value = p.address; q('p_dob').value = p.dob; q('p_cpf').value = p.cpf;
q('p_allergies').value = p.allergies; q('p_notes').value = p.notes;
// remove antigo e salvar ao submeter (simples approach)
deletePatient(id);
}

/* --------- PRONTUÁRIO --------- */
function renderPatientSelects(){
store = loadStore();
const selIds = ['rec_patientSelect','appt_patient','appt_patient','pay_appt'];
const patients = store.patients || [];
selIds.forEach(id=>{
const el = q(id);
if(!el) return;
el.innerHTML = '<option value="">-- selecione --</option>' + patients.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
});
}

async function addRecord(){
const pid = q('rec_patientSelect').value;
if(!pid) return alert('Escolha um paciente');
const text = q('rec_text').value.trim();
if(!text) return alert('Escreva a anotação');
let files = [];
const f = q('rec_file').files[0];
if(f){
files.push({name:f.name, data: await fileToDataURL(f)});
}
store = loadStore();
store.records = store.records || [];
const rec = {id:uid(), patientId:pid, text, files, author: currentUser.login, time: new Date().toISOString()};
store.records.push(rec);
saveStore(store);
addLog('add_record',{patientId:pid, recordId:rec.id});
q('rec_text').value=''; q('rec_file').value='';
renderRecords();
}

function renderRecords(){
store = loadStore();
const pid = q('rec_patientSelect').value;
const qv = q('rec_search').value.trim().toLowerCase();
let recs = (store.records||[]).slice().reverse();
if(pid) recs = recs.filter(r=>r.patientId===pid);
if(qv) recs = recs.filter(r => (r.text||'').toLowerCase().includes(qv));
q('recordList').innerHTML = recs.map(r=>{
return `<div class="item">       <small>${r.time} • ${r.author}</small><br>
      ${escapeHtml(r.text)}<br>
      ${r.files && r.files.length? r.files.map(f=>`<a href="${f.data}" target="_blank">${f.name}</a>`).join(' | '):''}     </div>`;
}).join('') || '<div class="muted">Nenhuma anotação</div>';
}

/* --------- AGENDA --------- */
function onSaveAppt(e){
e.preventDefault();
const pid = q('appt_patient').value;
const dentist = q('appt_dentist').value.trim();
const dt = q('appt_dt').value;
const dur = parseInt(q('appt_dur').value||30,10);
if(!pid || !dentist || !dt) return alert('Preencha paciente, dentista e data/hora');
store = loadStore();
store.appointments = store.appointments || [];
// conflito simples: overlap for same dentist
const newStart = new Date(dt).getTime();
const newEnd = newStart + dur*60000;
const conflict = (store.appointments||[]).find(a=>{
if(a.dentist !== dentist) return false;
const s = new Date(a.datetime).getTime();
const e = s + (a.duration||30)*60000;
return !(newEnd <= s || newStart >= e);
});
if(conflict && !confirm('Conflito de horário detectado. Deseja salvar mesmo assim?')) return;
const appt = {id:uid(), patientId:pid, dentist, datetime:dt, duration:dur, notes: q('appt_notes').value, status:'agendado'};
store.appointments.push(appt);
saveStore(store);
addLog('create_appointment',{id:appt.id});
q('apptForm').reset();
renderAgendaDay(new Date().toISOString().slice(0,10), dentist);
renderPatientSelects();
}

function renderAgendaDay(date, dentist){
store = loadStore();
const day = date || new Date().toISOString().slice(0,10);
const list = (store.appointments||[]).filter(a=>{
if(dentist && a.dentist !== dentist) return false;
return a.datetime.slice(0,10) === day;
}).sort((a,b)=>a.datetime.localeCompare(b.datetime));
q('agendaList').innerHTML = list.map(a=>{
const patient = (store.patients||[]).find(p=>p.id===a.patientId) || {};
return `<div class="item">       <b>${patient.name||'--'}</b> <small>${a.datetime} • ${a.duration}min</small><br>
      ${a.notes||''}<br>       <div class="actions">         <button onclick="cancelAppt('${a.id}')">Cancelar</button>         <button onclick="editAppt('${a.id}')" class="secondary">Editar</button>       </div>     </div>`;
}).join('') || '<div class="muted">Nenhuma consulta neste dia</div>';
// dentist selector
renderAgendaDentists();
}

function renderAgendaDentists(){
store = loadStore();
const dentists = (store.users||[]).filter(u=>u.role==='dentist' || u.role==='admin');
q('agendaDentist').innerHTML = '<option value="">-- todos --</option>' + dentists.map(d=>`<option value="${d.login}">${d.name} (${d.login})</option>`).join('');
}

function cancelAppt(id){
if(!confirm('Cancelar agendamento?')) return;
store = loadStore();
store.appointments = (store.appointments||[]).map(a=> a.id===id? {...a, status:'cancelado'} : a );
saveStore(store);
addLog('cancel_appointment',{id});
renderAgendaDay(new Date().toISOString().slice(0,10));
}

function editAppt(id){
const a = (loadStore().appointments||[]).find(x=>x.id===id);
if(!a) return alert('Agendamento não encontrado');
q('appt_patient').value = a.patientId;
q('appt_dentist').value = a.dentist;
q('appt_dt').value = a.datetime;
q('appt_dur').value = a.duration;
q('appt_notes').value = a.notes;
// remove old and let user save new
store = loadStore();
store.appointments = (store.appointments||[]).filter(x=>x.id!==id);
saveStore(store);
addLog('edit_appt',{id});
}

/* --------- PAYMENTS (Financeiro) --------- */
function onSavePayment(e){
e.preventDefault();
const apptId = q('pay_appt').value;
const amount = parseFloat(q('pay_amount').value||0);
const method = q('pay_method').value;
if(!apptId || !amount) return alert('Escolha agendamento e valor');
store = loadStore();
store.payments = store.payments || [];
const p = {id:uid(), appointmentId:apptId, patientId: (store.appointments.find(a=>a.id===apptId)||{}).patientId, amount, method, time: new Date().toISOString()};
store.payments.push(p);
saveStore(store);
addLog('payment_registered',{id:p.id});
renderPayments();
}

function renderPayments(){
store = loadStore();
q('paymentsList').innerHTML = (store.payments||[]).slice().reverse().map(pay=>{
const patient = (store.patients||[]).find(p=>p.id===pay.patientId) || {};
return `<div class="item">${patient.name || '--'} — R$ ${Number(pay.amount).toFixed(2)} • ${pay.method} • ${pay.time}</div>`;
}).join('') || '<div class="muted">Nenhum pagamento</div>';
// fill pay_appt select
q('pay_appt').innerHTML = '<option value="">-- selecione agendamento --</option>' + (store.appointments||[]).map(a=>{
const p = (store.patients||[]).find(x=>x.id===a.patientId) || {};
return `<option value="${a.id}">${p.name||'--'} — ${a.datetime}</option>`;
}).join('');
}

/* --------- REPORTS & EXPORTS ---------- */
function reportRevenue(){
store = loadStore();
const total = (store.payments||[]).reduce((s,p)=>s+Number(p.amount),0);
q('reportArea').innerHTML = `<h3>Total faturado: R$ ${total.toFixed(2)}</h3>`;
}
function reportPatients(){
store = loadStore();
const patientIds = Array.from(new Set((store.appointments||[]).filter(a=>a.status!=='cancelado').map(a=>a.patientId)));
const names = patientIds.map(id => (store.patients||[]).find(p=>p.id===id)?.name || id);
q('reportArea').innerHTML = `<h3>Pacientes atendidos (${names.length})</h3>` + names.join('<br>');
}

function exportCSV(type){
store = loadStore();
let rows = [];
if(type==='patients'){
rows = [['id','name','cpf','phone','email','dob','address','allergies','notes']].concat((store.patients||[]).map(p=>[p.id,p.name,p.cpf||'',p.phone||'',p.email||'',p.dob||'',p.address||'',p.allergies||'',p.notes||'']));
} else if(type==='appointments'){
rows = [['id','patientId','patientName','dentist','datetime','duration','status']].concat((store.appointments||[]).map(a=>[a.id,a.patientId, (store.patients||[]).find(p=>p.id===a.patientId)?.name||'',a.dentist,a.datetime,a.duration,a.status]));
}
const csv = rows.map(r=>r.map(c=>`"${String(c||'').replace(/"/g,'""')}"`).join(',')).join('\n');
const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = (type||'export')+'.csv'; a.click(); URL.revokeObjectURL(url);
}

function exportAllCSV(){
exportCSV('patients');
exportCSV('appointments');
}

/* --------- USERS & AUDIT --------- */
async function onCreateUser(){
const login = q('u_login').value.trim();
const name = q('u_name').value.trim();
const pass = q('u_pass').value;
const role = q('u_role').value;
if(!login||!name||!pass) return alert('Preencha login, nome e senha');
const h = await sha256hex(pass);
store = loadStore();
store.users = store.users || [];
if(store.users.find(u=>u.login===login)) return alert('Login já existe');
store.users.push({id:uid(), login, name, passHash:h, role});
saveStore(store);
addLog('create_user',{login});
renderUsersArea();
}

/* render users & logs */
function renderUsersArea(){
store = loadStore();
if(!q('usersArea')) return;
q('usersArea').innerHTML = '<h3>Usuários</h3>' + (store.users||[]).map(u=>`<div>${u.name} (${u.login}) - ${u.role}</div>`).join('') +
'<h4>Logs</h4><div class="mono">' + ((store.logs||[]).slice().reverse().slice(0,50).map(l=>`${l.time} | ${l.user} | ${l.action} | ${JSON.stringify(l.details)}`).join('<br>')) + '</div>';
}

/* --------- DASHBOARD METRICS --------- */
function renderDashboard(){
store = loadStore();
const patients = (store.patients||[]).length;
const appts = (store.appointments||[]).filter(a=>a.status!=='cancelado').length;
const revenue = (store.payments||[]).reduce((s,p)=>s+Number(p.amount),0);
q('dashboardMetrics').innerHTML = `<div class="card"><h4>Pacientes</h4><div class="badge">${patients}</div></div>     <div class="card"><h4>Agendamentos</h4><div class="badge">${appts}</div></div>     <div class="card"><h4>Faturamento (R$)</h4><div class="badge">${revenue.toFixed(2)}</div></div>`;
}

/* --------- REMINDERS (simulado) --------- */
function periodicReminderChecker(){
setInterval(()=> {
if(!currentUser) return;
store = loadStore();
const now = new Date();
(store.reminders||[]).forEach(r=>{
if(!r.sent && new Date(r.sendAt) <= now){
r.sent = true;
addLog('reminder_sent',{id:r.id, appointmentId:r.appointmentId});
}
});
saveStore(store);
}, 30*1000);
}

/* helper to show patient detail / open records view */
function viewPatient(id){
showView('records');
q('rec_patientSelect').value = id;
renderRecords();
}

/* small helpers */
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"]/g, m=>({'&':'&','<':'<','>':'>','"':'"'}[m])); }
function fileToDataURL(file){ return new Promise((res,rej)=>{ const fr = new FileReader(); fr.onload = e => res(e.target.result); fr.onerror = rej; fr.readAsDataURL(file); }) }
function renderPatientSelects(){ // initial fill
store = loadStore();
const pts = (store.patients||[]).map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
['rec_patientSelect','appt_patient','pay_appt'].forEach(id=>{
if(q(id)) q(id).innerHTML = '<option value="">-- selecione --</option>' + pts;
});
}

/* inicial refresh */
setTimeout(()=>{ store = loadStore(); renderDashboard(); renderPatientSelects(); renderAgendaDentists(); renderPayments(); renderUsersArea(); }, 200);
