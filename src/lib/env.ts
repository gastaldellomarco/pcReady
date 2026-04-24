function getEnvVariable(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[key];

  if (!value) {
    throw new Error(`Variabile ambiente mancante: ${key}`);
  }

  return value;
}

export const env = {
  supabaseUrl: getEnvVariable('VITE_SUPABASE_URL'),
  supabaseAnonKey: getEnvVariable('VITE_SUPABASE_ANON_KEY'),
};