interface HomeHeaderProps {
  greeting: string;
  subtitle: string;
}

function timeOfDayGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeHeader({ greeting, subtitle }: HomeHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold text-slate-900">
        {timeOfDayGreeting()}, {greeting}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
    </div>
  );
}
