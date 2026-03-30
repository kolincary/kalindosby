import React from 'react';

export const SkeletonLoader: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

export const DashboardStatsSkeletons: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white rounded-lg shadow-md p-6">
        <SkeletonLoader className="h-4 w-32 mb-4" />
        <SkeletonLoader className="h-8 w-16" />
      </div>
    ))}
  </div>
);

export const SearchBoxSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-8">
    <SkeletonLoader className="h-6 w-40 mb-4" />
    <SkeletonLoader className="h-10 w-full" />
  </div>
);

export const StockTableSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden">
    <div className="p-6 border-b">
      <SkeletonLoader className="h-6 w-48" />
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {[1, 2, 3, 4, 5].map((i) => (
              <th key={i} className="px-6 py-3">
                <SkeletonLoader className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {[1, 2, 3, 4, 5].map((i) => (
            <tr key={i}>
              {[1, 2, 3, 4, 5].map((j) => (
                <td key={j} className="px-6 py-4">
                  <SkeletonLoader className="h-4 w-20" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
