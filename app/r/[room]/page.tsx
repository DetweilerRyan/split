'use client';

import { useParams } from 'next/navigation';
import RoomApp from '../../RoomApp';

export default function RoomPage() {
  const { room } = useParams<{ room: string }>();
  return <RoomApp room={room} />;
}
