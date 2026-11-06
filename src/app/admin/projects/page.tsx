import AdminProjects from '@/components/admin-projects';
import AdminDashboardPanel from '@/components/admin-dashboard-panel';

export default function ProjectsPage() {
  return (
    <div className="p-6">
      <AdminDashboardPanel />
      <AdminProjects />
    </div>
  );
}
