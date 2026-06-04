-- Membuat tabel 'kas' untuk mencatat pemasukan dan pengeluaran
CREATE TABLE public.kas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('IN', 'OUT')),
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- (Opsional) Mengaktifkan Row Level Security (RLS) jika Anda menggunakannya di Supabase
ALTER TABLE public.kas ENABLE ROW LEVEL SECURITY;

-- Kebijakan RLS (Policy) agar pengguna bisa melihat data kas
CREATE POLICY "Semua pengguna bisa melihat catatan kas" 
ON public.kas FOR SELECT 
USING (true);

-- Kebijakan RLS (Policy) agar BENDAHARA dan PEMBINA bisa menambahkan catatan kas
-- Asumsinya: insert dilakukan melalui backend dengan service_role, jadi bypass RLS,
-- Tapi jika insert dari klien secara langsung, policy ini dibutuhkan.
CREATE POLICY "Bendahara dan Pembina bisa menambah kas" 
ON public.kas FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() 
        AND profiles.role IN ('BENDAHARA', 'PEMBINA', 'ADMIN')
    )
);
