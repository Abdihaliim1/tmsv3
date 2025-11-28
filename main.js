
/* 
 * ATS FREIGHT LLC - MAIN LOGIC
 * Updated for Modern UI (Slate/Inter Theme)
 */

// ... (Keep CONFIG and Firebase Initialization exactly as is) ...

// --- UPDATE RENDER FUNCTIONS FOR NEW UI ---

// 1. Render Dashboard KPI & Recent Loads
window.updateDashboard = function() {
    if (!DataManager.initialized) return;

    const loads = DataManager.loads || [];
    const drivers = DataManager.drivers || [];
    
    // Calculate KPI
    const revenue = loads.reduce((sum, l) => sum + (parseFloat(l.rate?.total) || 0), 0);
    const activeLoads = loads.filter(l => ['dispatched', 'in_transit'].includes(l.status)).length;
    const activeDrivers = drivers.filter(d => d.status === 'active').length;
    const profit = revenue * 0.15; // Mock calculation

    // Update DOM with formatted values
    if(document.getElementById('dashboardRevenue')) 
        document.getElementById('dashboardRevenue').textContent = Utils.formatCurrency(revenue);
    
    if(document.getElementById('dashboardActiveLoads'))
        document.getElementById('dashboardActiveLoads').textContent = activeLoads;

    if(document.getElementById('dashboardActiveDrivers'))
        document.getElementById('dashboardActiveDrivers').textContent = activeDrivers;
    
    if(document.getElementById('dashboardProfit'))
        document.getElementById('dashboardProfit').textContent = Utils.formatCurrency(profit);

    // Render Recent Loads Table (New Tailwind UI)
    const recentTable = document.getElementById('recentLoadsBody');
    if (recentTable) {
        const recent = loads.slice(0, 5);
        recentTable.innerHTML = recent.map(load => `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="font-medium text-blue-600">${load.loadNumber}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(load.status)}">
                        ${(load.status || 'Available').replace('_', ' ').toUpperCase()}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-2 text-sm text-slate-600">
                        <span class="font-medium text-slate-900">${load.pickup?.city || 'Origin'}</span>
                        <span class="text-slate-400">→</span>
                        <span class="font-medium text-slate-900">${load.delivery?.city || 'Dest'}</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    ${load.customer || 'Unknown'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-900">
                    ${Utils.formatCurrency(load.rate?.total || 0)}
                </td>
            </tr>
        `).join('');
    }
};

// Helper for Status Colors (Tailwind)
function getStatusColor(status) {
    switch (status) {
        case 'available': return 'bg-slate-100 text-slate-700 border-slate-200';
        case 'dispatched': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        case 'in_transit': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'completed': return 'bg-purple-50 text-purple-700 border-purple-200';
        case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
        default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
}

// 2. Render Loads List (Card Style for Loads Page)
window.renderLoads = function() {
    const listContainer = document.getElementById('loadsList');
    if (!listContainer) return;

    const loads = DataManager.loads || [];
    
    if (loads.length === 0) {
        listContainer.innerHTML = `
            <div class="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500">
                No loads found. Use the "New Load" button to add one.
            </div>`;
        return;
    }

    listContainer.innerHTML = loads.map(load => `
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 group cursor-pointer" onclick="editLoad('${load.id}')">
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                
                <!-- ID & Status -->
                <div class="flex items-center justify-between lg:justify-start lg:w-1/4 gap-4">
                    <div>
                        <div class="flex items-center gap-3 mb-1">
                            <span class="font-bold text-lg text-blue-600">${load.loadNumber}</span>
                            <span class="px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(load.status)}">
                                ${(load.status || '').replace('_', ' ').toUpperCase()}
                            </span>
                        </div>
                        <div class="text-sm text-slate-500 font-medium">${load.customer || 'Unknown Customer'}</div>
                    </div>
                </div>

                <!-- Route -->
                <div class="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-6 lg:px-8 lg:border-x lg:border-slate-100">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 text-slate-900 font-medium mb-1">
                            <i class="fas fa-map-marker-alt text-blue-500"></i>
                            ${load.pickup?.city || ''}, ${load.pickup?.state || ''}
                        </div>
                        <div class="text-xs text-slate-500 pl-6">
                            ${load.pickup?.date || 'No Date'}
                        </div>
                    </div>

                    <div class="hidden sm:flex flex-col items-center px-4">
                        <span class="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full mb-1">${load.mileage?.total || 0} mi</span>
                        <div class="w-24 h-[2px] bg-slate-200 relative"></div>
                    </div>

                    <div class="flex-1 sm:text-right">
                        <div class="flex items-center sm:justify-end gap-2 text-slate-900 font-medium mb-1">
                            <i class="fas fa-map-marker-alt text-emerald-500"></i>
                            ${load.delivery?.city || ''}, ${load.delivery?.state || ''}
                        </div>
                        <div class="text-xs text-slate-500 sm:pr-6">
                            ${load.delivery?.date || 'No Date'}
                        </div>
                    </div>
                </div>

                <!-- Financials -->
                <div class="lg:w-1/4 flex flex-row lg:flex-col justify-between lg:items-end gap-1 lg:gap-2">
                    <div class="text-right">
                        <div class="text-xl font-bold text-slate-900">${Utils.formatCurrency(load.rate?.total || 0)}</div>
                        <div class="text-xs text-slate-500 font-medium">
                            ${Utils.formatCurrency(load.rate?.ratePerMile || 0)} / mi
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 lg:mt-2">
                        <div class="text-xs px-2 py-1 bg-slate-100 rounded text-slate-600 font-medium max-w-[120px] truncate">
                            ${load.driver || 'Unassigned'}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    `).join('');
};

// ... (Keep existing DataManager logic, Auth, Utils, etc. exactly as they were to preserve functionality) ...
// ... (Just override the rendering functions as shown above) ...

// Ensure we expose functions globally
window.updateDashboard = updateDashboard;
window.renderLoads = renderLoads;

