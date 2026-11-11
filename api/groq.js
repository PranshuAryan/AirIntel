// Vercel serverless proxy: keeps GROQ_API_KEY on the server so it never reaches the browser.
const ALLOWED=['openai/gpt-oss-120b','openai/gpt-oss-20b','qwen/qwen3.8-27b'];
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:{message:'POST only'}});
  const key=process.env.GROQ_API_KEY;
  if(!key)return res.status(500).json({error:{message:'GROQ_API_KEY is not set in Vercel environment variables'}});
  try{
    const b=typeof req.body==='string'?JSON.parse(req.body):(req.body||{});
    if(!Array.isArray(b.messages)||b.messages.length>40||!ALLOWED.includes(b.model))return res.status(400).json({error:{message:'Bad request'}});
    b.max_tokens=Math.min(Number(b.max_tokens)||1000,2000);
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(b)});
    res.setHeader('Content-Type','application/json');
    return res.status(r.status).send(await r.text());
  }catch(e){return res.status(500).json({error:{message:e.message}})}
}
