import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function api(path, options = {}) {
  const token = localStorage.getItem('skilllink_access_token');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function Login({ onLogin }) {
  const [mode,setMode]=useState('login');
  const [form,setForm]=useState({email:'',password:'',fullName:''});
  const [busy,setBusy]=useState(false), [error,setError]=useState('');

  async function submit(e){
    e.preventDefault(); setBusy(true); setError('');
    try{
      const d=await api(mode==='login'?'/auth/login':'/auth/signup',{
        method:'POST',body:JSON.stringify(form)
      });
      localStorage.setItem('skilllink_access_token',d.accessToken);
      onLogin(d.user);
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  return <section className="auth-shell">
    <div className="hero"><span className="eyebrow">SKILLLINK</span><h1>Skills into opportunity.</h1><p>A real learning and commerce platform built around verified progress.</p></div>
    <form className="card auth-card" onSubmit={submit}>
      <h2>{mode==='login'?'Sign in':'Create account'}</h2>
      {mode==='signup'&&<label>Full name<input required value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/></label>}
      <label>Email<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
      <label>Password<input required type="password" minLength="10" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
      {error&&<div className="error">{error}</div>}
      <button className="primary" disabled={busy}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'}</button>
      <button type="button" className="link" onClick={()=>{setMode(mode==='login'?'signup':'login');setError('')}}>{mode==='login'?'Create account':'Back to sign in'}</button>
    </form>
  </section>
}

function CeoDashboard({user,onLogout}){
  const [tab,setTab]=useState('overview');
  const [data,setData]=useState(null),[users,setUsers]=useState([]),[packages,setPackages]=useState([]),[logs,setLogs]=useState([]),[courses,setCourses]=useState([]);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);

  async function load(){
    try{
      setError('');
      const [o,u,p,l]=await Promise.all([
        api('/ceo/overview'),api('/ceo/users'),api('/ceo/packages'),api('/ceo/audit-logs'),api('/courses/public')
      ]);
      setData(o);setUsers(u.users);setPackages(p.packages);setLogs(l.logs);setCourses(c.courses);
    }catch(e){setError(e.message)}
  }
  useEffect(()=>{load()},[]);

  async function savePackage(p){
    setBusy(true);setError('');
    try{
      await api('/ceo/packages/'+p.id,{method:'PATCH',body:JSON.stringify({
        pricePaise:Number(p.price_paise),subtitle:p.subtitle,description:p.description,
        accessDays:p.access_days,isActive:p.is_active,isFeatured:p.is_featured
      })});
      await load();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  async function changeStatus(id,status){
    setBusy(true);setError('');
    try{await api('/ceo/users/'+id+'/status',{method:'PATCH',body:JSON.stringify({status})});await load()}
    catch(e){setError(e.message)}finally{setBusy(false)}
  }

  return <div className="ceo-app">
    <header className="nav"><div className="brand"><span className="mark">S</span> SkillLink <span className="role-badge">CEO</span></div><button className="ghost" onClick={onLogout}>Logout</button></header>
    <div className="ceo-layout">
      <aside className="sidebar">
        {['overview','users','packages','courses','commissions','audit'].map(x=><button className={tab===x?'side active':'side'} onClick={()=>setTab(x)} key={x}>{x[0].toUpperCase()+x.slice(1)}</button>)}
      </aside>
      <main className="ceo-main">
        {error&&<div className="error">{error}</div>}
        {tab==='overview'&&<><span className="eyebrow">CONTROL CENTER</span><h1>Platform overview</h1><div className="stats">{[
          ['Users',data?.users],['Orders',data?.orders],['Pending withdrawals',data?.pendingWithdrawals],['Published courses',data?.publishedCourses],['Active packages',data?.activePackages]
        ].map(([a,b])=><div className="stat card" key={a}><span>{a}</span><strong>{b??'—'}</strong></div>)}</div></>}
        {tab==='users'&&<><h1>Users</h1><div className="table-wrap card"><table><thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.full_name}</td><td>{u.email}</td><td>{u.roles.join(', ')}</td><td>{u.status}</td><td>{u.id!==user.id&&<select value={u.status} disabled={busy} onChange={e=>changeStatus(u.id,e.target.value)}><option>active</option><option>suspended</option><option>disabled</option><option>pending</option></select>}</td></tr>)}</tbody></table></div></>}
        {tab==='packages'&&<><h1>Packages</h1><div className="package-admin">{packages.map(p=><div className="card edit-card" key={p.id}><span className="tag">{p.code}</span><h2>{p.name}</h2><label>Subtitle<input value={p.subtitle} onChange={e=>setPackages(packages.map(x=>x.id===p.id?{...x,subtitle:e.target.value}:x))}/></label><label>Price ₹<input type="number" min="0" value={p.price_paise/100} onChange={e=>setPackages(packages.map(x=>x.id===p.id?{...x,price_paise:Math.round(Number(e.target.value)*100)}:x))}/></label><label>Description<textarea value={p.description||''} onChange={e=>setPackages(packages.map(x=>x.id===p.id?{...x,description:e.target.value}:x))}/></label><button className="primary" disabled={busy} onClick={()=>savePackage(p)}>Save changes</button></div>)}</div></>}
        {tab==='courses'&&<><h1>Published course mapping</h1><div className="package-admin">{packages.map(p=><div className="card edit-card" key={p.id}><span className="tag">{p.code}</span><h2>{p.name}</h2><p className="muted">Select published courses included in this package.</p><select multiple value={courses.filter(c=>c.package_ids?.includes(p.id)).map(c=>c.id)} onChange={async e=>{const ids=[...e.target.selectedOptions].map(o=>o.value);setBusy(true);setError('');try{await api('/courses/packages/'+p.id+'/courses',{method:'PUT',body:JSON.stringify({courseIds:ids})});await load()}catch(err){setError(err.message)}finally{setBusy(false)}}}>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></div>)}</div></>}
  {tab==='commissions'&&<CommissionManager packages={packages} />}
  {tab==='audit'&&<><h1>Audit logs</h1><div className="table-wrap card"><table><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead><tbody>{logs.map(l=><tr key={l.id}><td>{new Date(l.created_at).toLocaleString()}</td><td>{l.actor_email||'System'}</td><td>{l.action}</td><td>{l.entity_type}</td></tr>)}</tbody></table></div></>}
      </main>
    </div>
  </div>
}

function PartnerDashboard({user,onLogout}){
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [amount,setAmount]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function load(){try{setError('');setData(await api('/partner/dashboard'))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  async function withdraw(){
    setBusy(true);setError('');setMessage('');
    try{await api('/partner/withdrawals',{method:'POST',body:JSON.stringify({amountPaise:Math.round(Number(amount)*100)})});setAmount('');setMessage('Withdrawal request created.');await load()}
    catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function createQr(){
    setBusy(true);setError('');
    try{await api('/partner/qr',{method:'POST',body:JSON.stringify({destinationPath:'/signup'})});await load()}
    catch(e){setError(e.message)}finally{setBusy(false)}
  }
  if(loading)return <div className="loading">Loading partner dashboard…</div>;
  const b=data?.balance||{};
  return <div className="ceo-app"><header className="nav"><div className="brand"><span className="mark">S</span> SkillLink <span className="role-badge">PARTNER</span></div><button className="ghost" onClick={onLogout}>Logout</button></header>
  <main className="partner-main">
    <span className="eyebrow">PARTNER CENTER</span><h1>Your earnings & referrals</h1>
    {error&&<div className="error">{error}</div>}{message&&<div className="success">{message}</div>}
    <div className="stats partner-stats">
      {[[`Total earned`,b.gross_earned_paise],[`Pending`,b.pending_paise],[`Available`,b.available_paise],[`Withdrawn`,b.withdrawn_paise],[`Referrals`,data?.referrals]].map(([a,v])=><div className="stat card" key={a}><span>{a}</span><strong>{a==='Referrals'?v??0:`₹${(Number(v||0)/100).toLocaleString('en-IN')}`}</strong></div>)}
    </div>
    <div className="partner-grid">
      <section className="card edit-card"><h2>Referral identity</h2><p className="muted">Referral ID</p><strong>{data?.partner?.referral_code}</strong><p className="muted">Use the generated QR/link to attribute registrations. A scan alone never creates commission.</p><button className="primary" disabled={busy} onClick={createQr}>Create referral QR</button></section>
      <section className="card edit-card"><h2>Request withdrawal</h2><p className="muted">Minimum ₹100. Only available verified balance can be requested.</p><label>Amount ₹<input type="number" min="100" step="1" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button className="primary" disabled={busy||!amount} onClick={withdraw}>{busy?'Processing…':'Request withdrawal'}</button></section>
    </div>
    <section className="card table-wrap" style={{marginTop:20}}><table><thead><tr><th>QR code</th><th>Status</th><th>Created</th></tr></thead><tbody>{(data?.qrCodes||[]).map(q=><tr key={q.id}><td>{q.code}</td><td>{q.is_active?'Active':'Inactive'}</td><td>{new Date(q.created_at).toLocaleString()}</td></tr>)}</tbody></table></section>
    <section className="card table-wrap" style={{marginTop:20}}><table><thead><tr><th>Withdrawal</th><th>Amount</th><th>Status</th><th>Requested</th></tr></thead><tbody>{(data?.withdrawals||[]).map(w=><tr key={w.id}><td>{w.id.slice(0,8)}…</td><td>₹{(w.amount_paise/100).toLocaleString('en-IN')}</td><td>{w.status}</td><td>{new Date(w.requested_at).toLocaleString()}</td></tr>)}</tbody></table></section>
  </main></div>
}

function StudentDashboard({user,onLogout}){
  const [tab,setTab]=useState('learning'),[catalog,setCatalog]=useState(null),[learning,setLearning]=useState([]),[orders,setOrders]=useState([]),[certs,setCerts]=useState([]),[live,setLive]=useState(null),[liveMine,setLiveMine]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  async function load(){
    try{
      setError('');
      const [c,l,o,ce,lv,lm]=await Promise.all([api('/student/catalog'),api('/student/learning'),api('/student/orders'),api('/student/certificates'),api('/live/catalog'),api('/live/mine')]);
      setCatalog(c);setLearning(l.enrollments);setOrders(o.orders);setCerts(ce.certificates);setLive(lv);setLiveMine(lm.registrations);
    }catch(e){setError(e.message)}finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);
  if(loading)return <div className="loading">Loading your learning…</div>;
  return <div className="ceo-app"><header className="nav"><div className="brand"><span className="mark">S</span> SkillLink <span className="role-badge">STUDENT</span></div><button className="ghost" onClick={onLogout}>Logout</button></header>
  <main className="student-main"><span className="eyebrow">MY LEARNING</span><h1>Welcome, {user.fullName}</h1>
  {error&&<div className="error">{error}</div>}
  <nav className="student-tabs">{['learning','courses','packages','live','orders','certificates'].map(x=><button className={tab===x?'tab active':'tab'} onClick={()=>setTab(x)} key={x}>{x[0].toUpperCase()+x.slice(1)}</button>)}</nav>
  {tab==='learning'&&<div className="student-grid">{learning.length?<>{learning.map(e=><article className="card learning-card" key={e.id}><span className="tag">{e.package_name||'Course'}</span><h2>{e.title||e.package_name}</h2><p className="muted">{e.description||'Your enrolled learning.'}</p><div className="progress"><span style={{width:`${Number(e.progress_percent||0)}%`}}/></div><strong>{Number(e.progress_percent||0)}% complete</strong></article>)}</>:<div className="card empty">You have no enrollments yet.</div>}</div>}
  {tab==='courses'&&<div className="student-grid">{(catalog?.courses||[]).map(c=><article className="card learning-card" key={c.id}><span className="tag">COURSE</span><h2>{c.title}</h2><p>{c.description||'Practical skill course.'}</p><strong>₹{(c.price_paise/100).toLocaleString('en-IN')}</strong></article>)}</div>}
  {tab==='packages'&&<div className="student-grid">{(catalog?.packages||[]).map(p=><article className="card learning-card" key={p.id}><span className="tag">{p.code}</span><h2>{p.name}</h2><p>{p.subtitle}</p><strong>₹{(p.price_paise/100).toLocaleString('en-IN')}</strong></article>)}</div>}
  {tab==='notifications'&&<NotificationCenter />
  {tab==='level'&&<LevelCard />}
  {tab==='live'&&<><h2>Masterclasses & Workshops</h2><div className="student-grid">{(live?.masterclasses||[]).map(x=><article className="card learning-card" key={x.id}><span className="tag">MASTERCLASS</span><h2>{x.title}</h2><p>{x.description||'Live learning experience.'}</p><strong>{Number(x.price_paise)?`₹${(x.price_paise/100).toLocaleString('en-IN')}`:'Free'}</strong><p className="muted">{x.starts_at?new Date(x.starts_at).toLocaleString():'Schedule TBA'}</p></article>)}{(live?.workshops||[]).map(x=><article className="card learning-card" key={x.id}><span className="tag">WORKSHOP</span><h2>{x.title}</h2><p>{x.description||'Practical workshop.'}</p><strong>{Number(x.price_paise)?`₹${(x.price_paise/100).toLocaleString('en-IN')}`:'Free'}</strong><p className="muted">{x.starts_at?new Date(x.starts_at).toLocaleString():'Schedule TBA'}</p></article>)}</div><h2 style={{marginTop:28}}>My registrations</h2><div className="card table-wrap"><table><thead><tr><th>Event</th><th>Status</th><th>Attendance</th></tr></thead><tbody>{liveMine.map(r=><tr key={r.id}><td>{r.masterclass_title||r.workshop_title}</td><td>{r.status}</td><td>{r.attendance_status||'—'}</td></tr>)}</tbody></table></div></>}
  {tab==='orders'&&<div className="card table-wrap"><table><thead><tr><th>Order</th><th>Item</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>{o.id.slice(0,8)}…</td><td>{o.package_name||o.course_title||'Item'}</td><td>₹{(o.amount_paise/100).toLocaleString('en-IN')}</td><td>{o.status}</td><td>{new Date(o.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
  {tab==='certificates'&&<div className="student-grid">{certs.length?certs.map(c=><article className="card learning-card" key={c.id}><span className="tag">CERTIFICATE</span><h2>{c.certificate_number}</h2><p>Issued {new Date(c.issued_at).toLocaleDateString()}</p></article>):<div className="card empty">No certificates issued yet.</div>}</div>}
  </main></div>
}

function InstructorDashboard({user,onLogout}){
  const [data,setData]=useState(null),[tab,setTab]=useState('courses'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [newCourse,setNewCourse]=useState({title:'',slug:'',description:'',pricePaise:0});
  const [newLesson,setNewLesson]=useState({courseId:'',title:'',content:'',sortOrder:0});
  const [event,setEvent]=useState({title:'',description:'',pricePaise:0,startsAt:'',seats:''});
  async function load(){try{setError('');setData(await api('/instructor/dashboard'))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  async function createCourse(e){e.preventDefault();setBusy(true);setError('');try{await api('/instructor/courses',{method:'POST',body:JSON.stringify(newCourse)});setNewCourse({title:'',slug:'',description:'',pricePaise:0});await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function addLesson(e){e.preventDefault();setBusy(true);setError('');try{await api('/instructor/courses/'+newLesson.courseId+'/lessons',{method:'POST',body:JSON.stringify({...newLesson,sortOrder:Number(newLesson.sortOrder)})});setNewLesson({...newLesson,title:'',content:''});await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function submitCourse(id){setBusy(true);setError('');try{await api('/instructor/courses/'+id+'/submit',{method:'POST'});await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function createEvent(type){setBusy(true);setError('');try{await api('/instructor/'+type,{method:'POST',body:JSON.stringify({...event,pricePaise:Number(event.pricePaise),seats:event.seats?Number(event.seats):null,startsAt:event.startsAt?new Date(event.startsAt).toISOString():null})});setEvent({title:'',description:'',pricePaise:0,startsAt:'',seats:''});await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
  if(loading)return <div className="loading">Loading instructor workspace…</div>;
  return <div className="ceo-app"><header className="nav"><div className="brand"><span className="mark">S</span> SkillLink <span className="role-badge">INSTRUCTOR</span></div><button className="ghost" onClick={onLogout}>Logout</button></header>
  <main className="instructor-main"><span className="eyebrow">INSTRUCTOR STUDIO</span><h1>Create. Teach. Grow.</h1>{error&&<div className="error">{error}</div>}
  <div className="stats"><div className="stat card"><span>Courses</span><strong>{data?.courses?.length||0}</strong></div><div className="stat card"><span>Students</span><strong>{data?.students||0}</strong></div><div className="stat card"><span>Paid sales</span><strong>{data?.sales?.count||0}</strong></div><div className="stat card"><span>Sales value</span><strong>₹{(Number(data?.sales?.amount||0)/100).toLocaleString('en-IN')}</strong></div></div>
  <nav className="student-tabs">{['courses','lessons','masterclasses','workshops','students'].map(x=><button className={tab===x?'tab active':'tab'} onClick={()=>setTab(x)} key={x}>{x[0].toUpperCase()+x.slice(1)}</button>)}</nav>
  {tab==='courses'&&<><form className="card instructor-form" onSubmit={createCourse}><h2>Create course draft</h2><input required placeholder="Course title" value={newCourse.title} onChange={e=>setNewCourse({...newCourse,title:e.target.value})}/><input required placeholder="url-slug" value={newCourse.slug} onChange={e=>setNewCourse({...newCourse,slug:e.target.value})}/><textarea placeholder="Description" value={newCourse.description} onChange={e=>setNewCourse({...newCourse,description:e.target.value})}/><input type="number" min="0" placeholder="Price ₹" value={newCourse.pricePaise/100} onChange={e=>setNewCourse({...newCourse,pricePaise:Math.round(Number(e.target.value)*100)})}/><button className="primary" disabled={busy}>{busy?'Saving…':'Create draft'}</button></form><div className="instructor-grid">{data.courses.map(c=><article className="card learning-card" key={c.id}><span className="tag">{c.status}</span><h2>{c.title}</h2><p>₹{(c.price_paise/100).toLocaleString('en-IN')}</p>{c.status!=='published'&&<button className="primary" disabled={busy} onClick={()=>submitCourse(c.id)}>Submit for approval</button>}</article>)}</div></>}
  {tab==='lessons'&&<form className="card instructor-form" onSubmit={addLesson}><h2>Add lesson</h2><select required value={newLesson.courseId} onChange={e=>setNewLesson({...newLesson,courseId:e.target.value})}><option value="">Select course</option>{data.courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select><input required placeholder="Lesson title" value={newLesson.title} onChange={e=>setNewLesson({...newLesson,title:e.target.value})}/><textarea placeholder="Learning content" value={newLesson.content} onChange={e=>setNewLesson({...newLesson,content:e.target.value})}/><button className="primary" disabled={busy}>Add lesson</button></form>}
  {tab==='masterclasses'&&<><form className="card instructor-form" onSubmit={e=>{e.preventDefault();createEvent('masterclasses')}}><h2>Masterclass draft</h2><input required placeholder="Title" value={event.title} onChange={e=>setEvent({...event,title:e.target.value})}/><textarea placeholder="Description" value={event.description} onChange={e=>setEvent({...event,description:e.target.value})}/><input type="number" min="0" placeholder="Price ₹" value={event.pricePaise/100} onChange={e=>setEvent({...event,pricePaise:Math.round(Number(e.target.value)*100)})}/><input type="datetime-local" value={event.startsAt} onChange={e=>setEvent({...event,startsAt:e.target.value})}/><input type="number" min="1" placeholder="Seats" value={event.seats} onChange={e=>setEvent({...event,seats:e.target.value})}/><button className="primary" disabled={busy}>Create draft</button></form><div className="instructor-grid">{data.masterclasses.map(x=><article className="card learning-card" key={x.id}><span className="tag">{x.status}</span><h2>{x.title}</h2><p>₹{(x.price_paise/100).toLocaleString('en-IN')}</p></article>)}</div></>}
  {tab==='workshops'&&<><form className="card instructor-form" onSubmit={e=>{e.preventDefault();createEvent('workshops')}}><h2>Workshop draft</h2><input required placeholder="Title" value={event.title} onChange={e=>setEvent({...event,title:e.target.value})}/><textarea placeholder="Description" value={event.description} onChange={e=>setEvent({...event,description:e.target.value})}/><input type="number" min="0" placeholder="Price ₹" value={event.pricePaise/100} onChange={e=>setEvent({...event,pricePaise:Math.round(Number(e.target.value)*100)})}/><input type="datetime-local" value={event.startsAt} onChange={e=>setEvent({...event,startsAt:e.target.value})}/><input type="number" min="1" placeholder="Seats" value={event.seats} onChange={e=>setEvent({...event,seats:e.target.value})}/><button className="primary" disabled={busy}>Create draft</button></form><div className="instructor-grid">{data.workshops.map(x=><article className="card learning-card" key={x.id}><span className="tag">{x.status}</span><h2>{x.title}</h2><p>₹{(x.price_paise/100).toLocaleString('en-IN')}</p></article>)}</div></>}
  {tab==='students'&&<div className="card table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Enrollments</th></tr></thead><tbody>{/* loaded through a separate endpoint in the next iteration */}<tr><td colSpan="3">Student list API is available; detailed interactive student management is reserved for later course/communication work.</td></tr></tbody></table></div>}
  </main></div>
}

function CommissionManager({packages}){
  const [packageId,setPackageId]=useState(''),[type,setType]=useState('fixed'),[value,setValue]=useState(''),[msg,setMsg]=useState(''),[err,setErr]=useState('');
  async function save(){
    try{
      setErr('');setMsg('');
      await api('/ceo/commission-rules',{method:'POST',body:JSON.stringify({packageId,commissionType:type,value:Number(value)})});
      setMsg('Commission rule saved.');
    }catch(e){setErr(e.message)}
  }
  return <div><h1>Commission rules</h1><div className="card edit-card"><p className="muted">CEO-only. These rules are applied by the verified-payment backend.</p><select value={packageId} onChange={e=>setPackageId(e.target.value)}><option value="">Select package</option>{packages.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select><select value={type} onChange={e=>setType(e.target.value)}><option value="fixed">Fixed ₹</option><option value="percent">Percent %</option></select><input type="number" min="0" step="0.01" value={value} onChange={e=>setValue(e.target.value)} placeholder="Commission value"/><button className="primary" disabled={!packageId||!value} onClick={save}>Save rule</button>{msg&&<div className="success">{msg}</div>}{err&&<div className="error">{err}</div>}</div></div>
}

function NotificationCenter(){
  const [items,setItems]=useState([]);
  useEffect(()=>{api('/notifications/mine').then(x=>setItems(x.notifications||[])).catch(()=>{})},[]);
  return <div><h1>Notifications</h1>{items.length===0?<div className="card empty">No notifications yet.</div>:items.map(n=><div className="card" key={n.id}><b>{n.title}</b><p>{n.message}</p><small>{new Date(n.created_at).toLocaleString()}</small></div>)}</div>
}
function LevelCard(){
  const [data,setData]=useState(null);
  useEffect(()=>{api('/commerce/levels/me').then(setData).catch(()=>{})},[]);
  if(!data)return <div className="card">Loading level progress…</div>;
  return <div><h1>Level Progress</h1><div className="card"><h2>{data.currentLevel}</h2><p>{data.points} points</p><p>Valid referrals: {data.validReferrals}</p>{data.level&&<p>Required points: {data.level.points_required}</p>}</div></div>
}

export default function App(){
  const [user,setUser]=useState(null),[loading,setLoading]=useState(true);
  useEffect(()=>{api('/me').then(d=>setUser(d.user)).catch(()=>{}).finally(()=>setLoading(false))},[]);
  function logout(){localStorage.removeItem('skilllink_access_token');setUser(null)}
  if(loading)return <div className="loading">Loading SkillLink…</div>;
  if(!user)return <Login onLogin={setUser}/>;
  if(user.role==='ceo')return <CeoDashboard user={user} onLogout={logout}/>;
  if(user.role==='partner')return <PartnerDashboard user={user} onLogout={logout}/>;
  if(user.role==='student')return <StudentDashboard user={user} onLogout={logout}/>;
  if(user.role==='instructor')return <InstructorDashboard user={user} onLogout={logout}/>;
  return <div className="loading">Signed in as {user.role}. This role dashboard is built in its scheduled phase. <button onClick={logout}>Logout</button></div>;
}
