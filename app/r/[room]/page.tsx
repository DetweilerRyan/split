'use client';

import { redirect, useParams } from 'next/navigation';
import { decodeRoomSegment } from '../../../src/store/seedCodec';
import { RoomView } from '../../RoomApp';

export default function RoomPage() {
  const { room } = useParams<{ room: string }>();
  const roomId = decodeRoomSegment(room);
  if (!roomId) redirect('/');
  return <RoomView key={roomId} roomId={roomId} />;
}
