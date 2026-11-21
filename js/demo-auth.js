(() => {
  const D=window.TaskFlowDemoData; if(!D)return;
  const $=s=>document.querySelector(s), read=(key,fallback=[])=>{try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}};
  const users=()=>read(D.KEYS.users,[]), saveUsers=u=>localStorage.setItem(D.KEYS.users,JSON.stringify(u));
  const notice=(message,type='success')=>{const el=$('#notice');if(el){el.textContent=message;el.className='notice show '+type;}};
  const session=(u)=>{const s={id:u.id,name:u.name,email:u.email,role:u.role,status:u.status||'active'};sessionStorage.setItem(D.KEYS.session,JSON.stringify(s));sessionStorage.setItem('taskflow_auth','true');return s;};
  const route=u=>location.href=u.role==='master-admin'?'master-admin-dashboard.html':u.role==='admin'?'admin-dashboard.html':'dashboard.html';
  const find=(email)=>users().find(u=>(u.email||'').toLowerCase()===email.toLowerCase());
  function login(kind,form){const email=form.querySelector('#email')?.value.trim().toLowerCase(),password=form.querySelector('#password')?.value;
    if(kind==='master-login'){const username=form.querySelector('#username')?.value.trim().toLowerCase();const u=users().find(x=>x.role==='master-admin'&&(x.email.toLowerCase()===username||x.name.toLowerCase()===username));if(!u||u.password!==password){notice('Incorrect Master Admin username/email or password.','error');return;}session(u);route(u);return;}
    const u=find(email);if(!u||u.password!==password||u.role!==(kind==='admin-login'?'admin':'user')){notice('Email or password is incorrect.','error');return;}
    if(u.role==='admin'&&u.status==='pending'){notice('Your administrator request is still awaiting Master Admin approval.','warning');return;}
    if(u.role==='admin'&&u.status==='approved'&&!u.verified){sessionStorage.setItem('taskflow_admin_verify_email',u.email);location.href='admin-verify.html';return;}
    if(u.status==='rejected'){notice('Your administrator request was rejected.','error');return;}
    session(u);route(u);
  }
  function register(kind,form){const name=form.querySelector('#name')?.value.trim(),email=form.querySelector('#email')?.value.trim().toLowerCase(),password=form.querySelector('#password')?.value,confirm=form.querySelector('#confirm')?.value;
    if(password!==confirm){notice('Passwords do not match.','error');return;}
    if(find(email)){notice('An account with this email already exists.','error');return;}
    const all=users(),newUser={id:'demo-'+Date.now(),name,email,password,role:kind==='admin-register'?'admin':'user',status:kind==='admin-register'?'pending':'active',createdAt:new Date().toISOString()};all.push(newUser);saveUsers(all);
    if(kind==='admin-register'){const req=read(D.KEYS.requests,[]);req.push({id:newUser.id,name,email,password,role:'admin',reason:form.querySelector('#reason')?.value.trim()||'',status:'pending',createdAt:newUser.createdAt});localStorage.setItem(D.KEYS.requests,JSON.stringify(req));notice('Demo request submitted. It is now pending Master Admin approval.','success');}
    else {notice('Demo account created! You can now sign in.','success');}
  }
  function verify(form){const email=form.querySelector('#email').value.trim().toLowerCase(),password=form.querySelector('#password').value,code=form.querySelector('#code').value.trim();const user=find(email),otp=localStorage.getItem(D.KEYS.otp);
    if(!user||user.password!==password||user.status!=='approved'||!otp||otp!==code||email!==localStorage.getItem('taskflow_demo_otp_email')){notice('Details or demo verification code are incorrect. Check the code shown by Master Admin.','error');return;}
    const all=users(),idx=all.findIndex(x=>x.email===email);all[idx].status='active';all[idx].verified=true;all[idx].activatedAt=new Date().toISOString();saveUsers(all);localStorage.removeItem(D.KEYS.otp);localStorage.removeItem('taskflow_demo_otp_email');session(all[idx]);route(all[idx]);
  }
  document.querySelectorAll('[data-demo-form]').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();const kind=form.dataset.demoForm;if(kind.endsWith('login'))login(kind,form);else if(kind.endsWith('register'))register(kind,form);else if(kind==='admin-verify')verify(form);}));
  if(location.pathname.endsWith('admin-verify.html')){const email=sessionStorage.getItem('taskflow_admin_verify_email');if(email&&$('#email'))$('#email').value=email;const code=localStorage.getItem(D.KEYS.otp);const help=$('.helper');if(code&&help)help.innerHTML=`<strong>Demo code available:</strong> ${code} — shown by Master Admin after approval. No email is sent.`;}
  // Add reset control on demo pages.
  document.addEventListener('DOMContentLoaded',()=>{const btn=document.createElement('button');btn.type='button';btn.textContent='Reset Demo';btn.title='Restore demo accounts and tasks';btn.style.cssText='position:fixed;right:14px;bottom:14px;z-index:9999;border:1px solid #cbd5e1;background:#fff;color:#334155;padding:9px 13px;border-radius:7px;font:600 12px Inter,Arial;box-shadow:0 2px 8px #0001;cursor:pointer';btn.addEventListener('click',()=>{if(confirm('Reset all demo accounts, approval status, and tasks to the initial state?')){D.reset();location.href='index.html';}});document.body.appendChild(btn);});
  window.TaskFlowDemoAuth={find,users,saveUsers,session,route,notice};
})();
