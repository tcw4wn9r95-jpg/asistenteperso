const puppeteer=require('puppeteer');
(async()=>{
  const b=await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const p=await b.newPage();
  await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await p.goto('http://localhost:8090/',{waitUntil:'networkidle2'});
  await p.evaluate(()=>{
    const KEY='claudio-v2';const s=JSON.parse(localStorage.getItem(KEY)||'{}');
    const win=[{start:'22:00',end:'23:59'}];
    s.availability={weekday:win,weekend:win};
    s.goals=[{id:'g1',title:'Sproochentest',description:'',targetDate:'2026-12-15',stepTitle:'Luxembourgish listening',stepMinutes:15,daysPerWeek:5,timeOfDay:'ANY',energy:'MED',generatedByModel:'x',createdAt:new Date().toISOString()}];
    s.tasks=[{id:'t1',title:'Call the dentist',minutes:15,timeOfDay:'ANY',energy:'LOW',latest:'2026-12-31',createdAt:new Date().toISOString()},{id:'t2',title:'Tidy kitchen',minutes:15,timeOfDay:'ANY',energy:'LOW',latest:'2026-12-31',createdAt:new Date().toISOString()}];
    localStorage.setItem(KEY,JSON.stringify(s));
  });
  await p.reload({waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,4500));
  await p.screenshot({path:'/tmp/n1-week.png'});
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
