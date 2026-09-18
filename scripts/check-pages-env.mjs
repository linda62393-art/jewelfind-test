// Fail before building rather than publish an offline app or a privileged key.
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
let claims
try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()) } catch { /* reject below */ }
if (url !== 'https://tsnqoybajiosufwngfsc.supabase.co' ||
    claims?.role !== 'anon' || claims?.ref !== 'tsnqoybajiosufwngfsc') {
  throw new Error('Configure the JEWELFIND public URL and legacy anon key in Actions secrets. Never use a service role key. The existing Edge gateway requires an anon JWT.')
}
console.log('Public Supabase configuration validated (values omitted).')
