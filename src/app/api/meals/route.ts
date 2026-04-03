import { NextRequest, NextResponse } from 'next/server';
import { getMealSummary, serveMeal, cancelMealManually, getKitchenReport } from '@/lib/meal-engine';
import { format } from 'date-fns';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const plantCode = searchParams.get('plant') || 'P1';
  const date = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const view = searchParams.get('view') || 'kitchen';

  if (view === 'kitchen') {
    const report = await getKitchenReport(plantCode, date);
    return NextResponse.json({ success: true, data: report });
  }

  const mealType = (searchParams.get('type') || 'ALMUERZO') as 'ALMUERZO' | 'CENA';
  const summary = await getMealSummary(plantCode, date, mealType);
  return NextResponse.json({ success: true, data: summary });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, employeeCode, mealType, date, reason, plantCode } = body;
  const today = date || format(new Date(), 'yyyy-MM-dd');

  if (action === 'serve') {
    const result = await serveMeal(employeeCode, mealType || 'ALMUERZO', today);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  if (action === 'cancel') {
    const result = await cancelMealManually(
      employeeCode,
      mealType || 'ALMUERZO',
      today,
      reason || 'MANUAL',
      plantCode || 'P1'
    );
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  }

  return NextResponse.json({ success: false, error: 'Acción no válida' }, { status: 400 });
}
