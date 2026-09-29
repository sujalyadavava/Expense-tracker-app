const OpenAI = require("openai");
let client;
const categories = ["Food", "Transport", "Travel", "Shopping", "Bills", "Entertainment", "Health", "Education", "Salary", "Other"];

function getClient(){
 const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
 if(!apiKey) return null;
 if(!client) {
  const defaultHeaders = {};
  if (process.env.OPENROUTER_SITE_URL) {
   defaultHeaders["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  }
  if (process.env.OPENROUTER_APP_NAME) {
   defaultHeaders["X-Title"] = process.env.OPENROUTER_APP_NAME;
  }
  client = new OpenAI({
   apiKey,
  baseURL:"https://openrouter.ai/api/v1",
   defaultHeaders,
  timeout:5000
  });
 }
 return client;
}

function localCategory(description){
 const text=` ${description.toLowerCase().replace(/[^a-z0-9]+/g," ").trim()} `;
 const signals={
  Food:["food","restaurant","lunch","dinner","breakfast","grocery","groceries","coffee","meal","pizza","burger","snack","swiggy","zomato","dominos"],
  Transport:["taxi","uber","ola","cab","metro","bus","train","railway","fuel","petrol","diesel","toll","parking","transport","auto","rickshaw"],
  Travel:["flight","airline","hotel","travel","trip","vacation","resort","airbnb","tour","booking"],
  Shopping:["shopping","shop","clothes","clothing","shirt","dress","shoes","fashion","amazon","flipkart","myntra","mall","store","purchase","bought","online"],
  Bills:["rent","electric","electricity","water","internet","wifi","phone","mobile","bill","insurance","recharge"],
  Entertainment:["movie","cinema","concert","game","gaming","netflix","spotify","music","entertainment","disney"],
  Health:["doctor","medicine","pharmacy","health","hospital","clinic","dentist","gym","medical","tablet"],
  Education:["school","course","book","tuition","education","college","university","class","exam"],
  Salary:["salary","paycheck","income","bonus","wages","freelance"]
 };
 let bestCategory="Other",bestScore=0;
 for(const category of Object.keys(signals)){
  const score=signals[category].reduce((total,word)=>total+(text.includes(` ${word} `)?1:0),0);
  if(score>bestScore){bestCategory=category;bestScore=score;}
 }
 return bestCategory;
}

async function categorizeExpense(description){
 if(!getClient())return { category: localCategory(description), source: "local" };
 try{
  const r=await getClient().chat.completions.create({
   model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
   temperature:0,
   messages:[
   {role:"system",content:`Return ONLY one category from: ${categories.join(", ")}.`},
   {role:"user",content:String(description).slice(0, 500)}
  ]});
     const answer=String(r.choices?.[0]?.message?.content || "").trim().toLowerCase();
    const category=categories.find(item=>item.toLowerCase()===answer);
    return { category: category || localCategory(description), source: category ? "ai" : "local" };
 }catch(e){return { category: localCategory(description), source: "local" };}
}
async function spendingInsight(expenses){
  if(!getClient())return { text: localInsight(expenses), source: "local" };
  const data=expenses.slice(0, 200).map(e=>({amount:e.amount,description:e.description,category:e.category}));
 try{
   const r=await getClient().chat.completions.create({
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    temperature:0.2,
    max_tokens:80,
    messages:[
   {role:"system",content:"Give one practical spending insight in under 30 words."},
   {role:"user",content:JSON.stringify(data)}
  ]});
  return { text: String(r.choices?.[0]?.message?.content || "").trim() || localInsight(expenses), source: "ai" };
 }catch(e){return { text: localInsight(expenses), source: "local" };}
}

function localInsight(expenses){
 const totals={};
 expenses.forEach(expense=>{totals[expense.category]=(totals[expense.category]||0)+Number(expense.amount);});
 const topCategory=Object.keys(totals).sort((a,b)=>totals[b]-totals[a])[0];
 const total=expenses.reduce((sum,expense)=>sum+Number(expense.amount),0);
  return topCategory
    ? `Your highest spending category is ${topCategory}, totaling ₹${totals[topCategory].toFixed(2)}. Total spending is ₹${total.toFixed(2)}.`
    : "Add a few expenses to receive a spending insight.";
}
module.exports={categorizeExpense,spendingInsight};
