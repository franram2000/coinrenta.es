'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteExchangeConnection } from './actions';
import { deleteLocalDataset } from '@/lib/client/local-cache';

export default function DeleteConnectionButton({ userId, connectionId }: { userId: string; connectionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button className="connection-delete" type="button" disabled={pending} onClick={() => {
    if (pending || !window.confirm('¿Eliminar esta conexión y sus datos almacenados en el servidor? Esta acción no se puede deshacer.')) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('connection_id', connectionId);
        await deleteExchangeConnection(formData);
        await deleteLocalDataset(userId, connectionId);
        router.refresh();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'No se pudo eliminar la conexión.');
      }
    });
  }}>{pending ? 'Eliminando…' : 'Eliminar conexión'}</button>;
}
