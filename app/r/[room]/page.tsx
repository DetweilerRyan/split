'use client';

import { redirect, useParams } from 'next/navigation';
import { decodeRoomSegment } from '../../../src/sync/seedCodec';
import { RoomViewRoot } from '../../RoomApp';

export default function RoomPage() {
  const { room } = useParams<{ readonly room: string }>();
  const roomId = decodeRoomSegment(room);
  if (roomId === null) redirect('/');
  return <RoomViewRoot key={roomId} roomId={roomId} />;
}
