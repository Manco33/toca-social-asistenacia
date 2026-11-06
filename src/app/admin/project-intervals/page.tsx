import React from 'react';
import ProjectIntervals from '@/components/project-intervals';

export const metadata = {
  title: 'Lapsos por Proyecto',
};

export default function Page() {
  return (
    <div className="p-4">
      <ProjectIntervals />
    </div>
  );
}
