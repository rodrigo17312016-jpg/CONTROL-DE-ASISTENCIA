import { NextRequest, NextResponse } from 'next/server';
import { processAttendanceScan } from '@/lib/attendance-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeCode, plantCode, method = 'QR' } = body;

    if (!employeeCode || !plantCode) {
      return NextResponse.json(
        { success: false, error: 'Se requiere código de empleado y código de planta' },
        { status: 400 }
      );
    }

    const result = await processAttendanceScan(employeeCode, plantCode, method);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing scan:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
