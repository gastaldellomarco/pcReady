-- Allow technicians to delete tickets (UI already limited to staff with edit rights;
-- previously only admins matched RLS and the modal delete button.)

DROP POLICY IF EXISTS "Admin delete tickets" ON public.tickets;

CREATE POLICY "Staff delete tickets" ON public.tickets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
