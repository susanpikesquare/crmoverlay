import AutoSaveTextarea from './AutoSaveTextarea';

export interface DayPlans {
  thirtyDay: string;
  sixtyDay: string;
  ninetyDay: string;
}

interface DayPlanSectionProps {
  dayPlans: DayPlans | null;
  onFieldChange: (key: string, value: string) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export default function DayPlanSection({
  dayPlans,
  onFieldChange,
  saveStatus,
}: DayPlanSectionProps) {
  const plans = dayPlans || { thirtyDay: '', sixtyDay: '', ninetyDay: '' };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">30 / 60 / 90 Day Plan</h2>
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${
          saveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' :
          saveStatus === 'saved' ? 'bg-green-100 text-green-700' :
          saveStatus === 'error' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-500'
        }`}>
          {saveStatus === 'saving' ? 'Saving...' :
           saveStatus === 'saved' ? 'Saved' :
           saveStatus === 'error' ? 'Error saving' : ''}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">30</span>
            <span className="text-sm font-bold text-blue-900">First 30 Days</span>
          </div>
          <AutoSaveTextarea
            label=""
            fieldName="thirtyDay"
            value={plans.thirtyDay}
            placeholder="Quick wins and immediate actions..."
            onChange={onFieldChange}
            rows={6}
          />
        </div>

        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">60</span>
            <span className="text-sm font-bold text-purple-900">Days 31-60</span>
          </div>
          <AutoSaveTextarea
            label=""
            fieldName="sixtyDay"
            value={plans.sixtyDay}
            placeholder="Build momentum and deepen engagement..."
            onChange={onFieldChange}
            rows={6}
          />
        </div>

        <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">90</span>
            <span className="text-sm font-bold text-indigo-900">Days 61-90</span>
          </div>
          <AutoSaveTextarea
            label=""
            fieldName="ninetyDay"
            value={plans.ninetyDay}
            placeholder="Strategic initiatives and long-term plays..."
            onChange={onFieldChange}
            rows={6}
          />
        </div>
      </div>
    </div>
  );
}
