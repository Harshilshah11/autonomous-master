import { NextRequest, NextResponse } from 'next/server';

const DUMMY_USERS: Record<string, { password: string; name: string }> = {
  'admin@arnobot.in': { password: 'arnobot123', name: 'Admin' },
  'pilot@arnobot.in': { password: 'pilot123', name: 'Pilot' },
};

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const user = DUMMY_USERS[email];
  if (!user || user.password !== password) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // base64-encoded token payload (not a real JWT — dev phase only)
  const token = Buffer.from(JSON.stringify({ email, name: user.name, role: 'operator' })).toString('base64');

  const res = NextResponse.json({ token, user: { email, name: user.name, role: 'operator' } });
  res.cookies.set('arno-auth', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 6,
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete('arno-auth');
  return res;
}
