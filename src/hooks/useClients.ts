import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type SelectOption = { value: string; label: string };

export function useClientsAndAssignees() {
  const [clientOptions, setClientOptions] = useState<SelectOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<SelectOption[]>([]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name')
          .eq('is_active', true);

        if (mounted && clients) {
          setClientOptions(
            (clients as any[])
              .map((c) => ({ value: c.id as string, label: c.name as string }))
              .sort((a, b) => a.label.localeCompare(b.label))
          );
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('is_active', true);

        if (mounted && profiles) {
          setAssigneeOptions(
            (profiles as any[])
              .map((p) => ({ value: p.id as string, label: p.full_name as string }))
              .sort((a, b) => a.label.localeCompare(b.label))
          );
        }
      } catch (e) {
        // noop
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { clientOptions, assigneeOptions };
}
