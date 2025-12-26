import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Check DB connection by counting users
    const result = await db
      .selectFrom('user')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst();

    return NextResponse.json({
      status: 'ok',
      db: 'connected',
      users: Number(result?.count ?? 0),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        db: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
