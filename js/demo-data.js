/* TaskFlow frontend demo seed data. Prototype only; do not use as real authentication. */
(() => {
  const KEYS = { users:'taskflow_users', requests:'taskflow_admin_requests', tasks:'taskflow_tasks', session:'taskflow_session', otp:'taskflow_demo_otp', state:'taskflow_demo_initialized' };
  const initialUsers = [
    {id:'demo-user-1',name:'Test User 1',email:'testuser1@mail.com',password:'user1234',role:'user',status:'active',createdAt:'2026-11-21T08:00:00.000Z'},
    {id:'demo-admin-1',name:'Test Admin 1',email:'testadmin1@mail.com',password:'admin1234',role:'admin',status:'pending',active:false,createdAt:'2026-11-21T08:00:00.000Z'},
    {id:'demo-master-1',name:'Master Admin 1',email:'masteradmin1@mail.com',password:'ma1234',role:'master-admin',status:'active',createdAt:'2026-11-21T08:00:00.000Z'}
  ];
  const initialTasks = [
    {id:'demo-task-1',ownerEmail:'testuser1@mail.com',title:'Complete assignment',description:'Finish and review the assignment before submission.',dueDate:'',priority:'high',status:'in_progress',createdAt:'2026-11-20T09:00:00.000Z',updatedAt:'2026-11-21T08:00:00.000Z'},
    {id:'demo-task-2',ownerEmail:'testuser1@mail.com',title:'Buy groceries',description:'Pick up essentials for the week.',dueDate:'',priority:'medium',status:'pending',createdAt:'2026-11-20T08:00:00.000Z'},
    {id:'demo-task-3',ownerEmail:'testuser1@mail.com',title:'Read chapter 4',description:'Review chapter notes.',dueDate:'',priority:'low',status:'completed',completedAt:'2026-11-20T10:00:00.000Z',createdAt:'2026-11-19T08:00:00.000Z'},
    {id:'demo-task-4',ownerEmail:'testuser1@mail.com',title:'Submit project',description:'Prepare final files and submit.',dueDate:'',priority:'high',status:'pending',createdAt:'2026-11-19T09:00:00.000Z'},
    {id:'demo-task-5',ownerEmail:'testuser1@mail.com',title:'Organize notes',description:'Sort notes by subject.',dueDate:'',priority:'low',status:'completed',completedAt:'2026-11-18T12:00:00.000Z',createdAt:'2026-11-18T08:00:00.000Z'}
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  function seed(force=false) {
    if(!force && localStorage.getItem(KEYS.state)==='true') return;
    localStorage.setItem(KEYS.users,JSON.stringify(clone(initialUsers)));
    localStorage.setItem(KEYS.requests,JSON.stringify([{id:'demo-request-1',name:'Test Admin 1',email:'testadmin1@mail.com',password:'admin1234',role:'admin',reason:'Demo administrator access request',status:'pending',createdAt:'2026-11-21T08:00:00.000Z'}]));
    localStorage.setItem(KEYS.tasks,JSON.stringify(clone(initialTasks)));
    localStorage.removeItem(KEYS.otp);
    localStorage.setItem(KEYS.state,'true');
  }
  function reset(){ seed(true); sessionStorage.removeItem(KEYS.session); sessionStorage.removeItem('taskflow_auth'); localStorage.removeItem('taskflow_session'); }
  window.TaskFlowDemoData={KEYS,initialUsers:clone(initialUsers),initialTasks:clone(initialTasks),seed,reset};
  seed();
})();
