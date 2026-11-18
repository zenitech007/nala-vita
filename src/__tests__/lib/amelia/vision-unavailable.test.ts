jest.mock('@/lib/gemini', () => ({ ai: {models:{}}, GEMINI_MODEL:'test' }));
import { visionChat } from '@/lib/amelia/llm';
it('F02 never fabricates findings without providers', async () => {
 const gemini=process.env.GEMINI_API_KEY, google=process.env.GOOGLE_API_KEY, openai=process.env.OPENAI_API_KEY;
 delete process.env.GEMINI_API_KEY; delete process.env.GOOGLE_API_KEY; delete process.env.OPENAI_API_KEY;
 try { const result=JSON.parse(await visionChat('read labs','data:image/png;base64,invalid'));
 expect(result.status).toBe('unavailable'); expect(result.results).toEqual([]); expect(result.summary).not.toMatch(/inspected|normal|expected parameters/i);
 } finally { for(const [k,v] of Object.entries({GEMINI_API_KEY:gemini,GOOGLE_API_KEY:google,OPENAI_API_KEY:openai})) {if(v===undefined) delete process.env[k];else process.env[k]=v;} }
});
