import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, X, CheckCircle, AlertCircle, Clock, FileText, Database, Cloud, BarChart3 } from 'lucide-react';
import { useTMS } from '../context/TMSContext';
import { Load, Employee, Expense, Truck, LoadStatus, NewLoadInput, NewEmployeeInput, NewExpenseInput, NewTruckInput } from '../types';

interface ImportHistory {
  id: string;
  dateTime: string;
  type: string;
  source: string;
  total: number;
  success: number;
  warnings: number;
  errors: number;
}

interface FieldMapping {
  [fileColumn: string]: string;
}

const Import: React.FC = () => {
  const { loads, employees, expenses, trucks, addLoad, addEmployee, addExpense, addTruck } = useTMS();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dataType, setDataType] = useState<'loads' | 'drivers' | 'customers' | 'expenses' | 'fleet'>('loads');
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [validateData, setValidateData] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [showFieldMapping, setShowFieldMapping] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [importProgress, setImportProgress] = useState({
    visible: false,
    status: '',
    percentage: 0,
    total: 0,
    success: 0,
    warnings: 0,
    errors: 0,
    errorList: [] as string[]
  });
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [datStatus, setDatStatus] = useState<'Not Configured' | 'Connected'>('Not Configured');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadImportHistory();
    checkDATStatus();
  }, []);

  const loadImportHistory = () => {
    const history = localStorage.getItem('importHistory');
    if (history) {
      setImportHistory(JSON.parse(history));
    }
  };

  const checkDATStatus = () => {
    const apiKey = localStorage.getItem('datApiKey');
    if (apiKey) {
      setDatStatus('Connected');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(f => 
      f.name.endsWith('.csv') || 
      f.name.endsWith('.xlsx') || 
      f.name.endsWith('.xls')
    );
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const parseFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          
          if (file.name.endsWith('.csv')) {
            // Simple CSV parser
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length === 0) {
              reject(new Error('Empty file'));
              return;
            }
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const data = lines.slice(1).map(line => {
              const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
              const obj: any = {};
              headers.forEach((header, index) => {
                obj[header] = values[index] || '';
              });
              return obj;
            });
            
            resolve(data);
          } else {
            // For Excel files, we'll need a library - for now, show error
            reject(new Error('Excel files require additional library. Please use CSV format.'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = reject;
      
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsBinaryString(file);
      }
    });
  };

  const getSystemFields = (type: string): { [key: string]: string[] } => {
    const fields: { [key: string]: { [key: string]: string[] } } = {
      loads: {
        loadNumber: ['loadnumber', 'load', 'pro', 'pronumber'],
        originCity: ['origincity', 'origin', 'pickupcity', 'fromcity'],
        originState: ['originstate', 'pickupstate', 'fromstate'],
        destCity: ['destcity', 'destinationcity', 'deliverycity', 'tocity'],
        destState: ['deststate', 'destinationstate', 'deliverystate', 'tostate'],
        rate: ['rate', 'price', 'amount', 'revenue'],
        miles: ['miles', 'mileage', 'distance'],
        customerName: ['customer', 'customername', 'broker', 'brokername']
      },
      drivers: {
        firstName: ['firstname', 'first', 'fname'],
        lastName: ['lastname', 'last', 'lname'],
        phone: ['phone', 'phonenumber', 'mobile', 'cell'],
        email: ['email', 'emailaddress'],
        employeeType: ['employeetype', 'type', 'classification', 'drivertype']
      },
      expenses: {
        type: ['type', 'category', 'expensetype'],
        amount: ['amount', 'cost', 'price'],
        date: ['date', 'expensedate', 'transactiondate'],
        description: ['description', 'desc', 'notes', 'memo']
      },
      fleet: {
        truckNumber: ['trucknumber', 'unitnumber', 'truck'],
        make: ['make', 'manufacturer'],
        model: ['model'],
        year: ['year', 'modelyear']
      }
    };
    return fields[type] || {};
  };

  const autoDetectMapping = (firstRow: any, type: string): FieldMapping => {
    const mapping: FieldMapping = {};
    const fileColumns = Object.keys(firstRow);
    const systemFields = getSystemFields(type);

    fileColumns.forEach(col => {
      const normalizedCol = col.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      for (const [sysField, aliases] of Object.entries(systemFields)) {
        if (Array.isArray(aliases) && aliases.some(alias => normalizedCol.includes(alias) || alias.includes(normalizedCol))) {
          mapping[col] = sysField;
          break;
        }
      }
    });

    return mapping;
  };

  const startFileImport = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select a file first');
      return;
    }

    try {
      const file = selectedFiles[0];
      const data = await parseFile(file);
      
      if (!data || data.length === 0) {
        alert('No data found in file');
        return;
      }

      const mapping = autoDetectMapping(data[0], dataType);
      setFieldMapping(mapping);
      setParsedData(data);

      if (validateData) {
        setShowFieldMapping(true);
      } else {
        setShowPreview(true);
      }
    } catch (error: any) {
      alert('Error parsing file: ' + error.message);
    }
  };

  const transformData = (data: any[]): any[] => {
    return data.map(row => {
      const transformed: any = {};
      Object.entries(fieldMapping).forEach(([fileCol, sysField]) => {
        transformed[sysField] = row[fileCol];
      });
      return transformed;
    });
  };

  const importRow = async (type: string, row: any, skipDup: boolean): Promise<string> => {
    try {
      if (type === 'loads') {
        const loadNumber = row.loadNumber || `L${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        if (skipDup && loads.find(l => l.loadNumber === loadNumber)) {
          return 'warning';
        }

        const newLoad: NewLoadInput = {
          status: LoadStatus.Available,
          customerName: row.customerName || 'Imported Customer',
          originCity: row.originCity || '',
          originState: row.originState || '',
          destCity: row.destCity || '',
          destState: row.destState || '',
          rate: parseFloat(row.rate || 0),
          miles: parseFloat(row.miles || 0),
          pickupDate: '',
          deliveryDate: '',
          driverId: '',
          driverName: ''
        };

        addLoad(newLoad);
        return 'success';
      } else if (type === 'drivers') {
        if (!row.firstName || !row.lastName) {
          return 'Missing required fields: firstName, lastName';
        }

        if (skipDup && employees.find(e => 
          e.firstName === row.firstName && e.lastName === row.lastName)) {
          return 'warning';
        }

        const newEmployee: NewEmployeeInput = {
          firstName: row.firstName,
          lastName: row.lastName,
          phone: row.phone || '',
          email: row.email || '',
          employeeType: (row.employeeType || 'driver') as any,
          type: (row.employeeType || 'driver') === 'owner_operator' ? 'OwnerOperator' : 'Company',
          status: 'active'
        };

        addEmployee(newEmployee);
        return 'success';
      } else if (type === 'expenses') {
        if (!row.amount || !row.type) {
          return 'Missing required fields: amount, type';
        }

        const newExpense: NewExpenseInput = {
          type: row.type,
          category: row.type,
          amount: parseFloat(row.amount || 0),
          date: row.date || new Date().toISOString().split('T')[0],
          description: row.description || '',
          paidBy: 'company',
          status: 'pending'
        };

        addExpense(newExpense);
        return 'success';
      } else if (type === 'fleet') {
        if (!row.truckNumber) {
          return 'Missing required field: truckNumber';
        }

        if (skipDup && trucks.find(t => t.number === row.truckNumber)) {
          return 'warning';
        }

        const newTruck: NewTruckInput = {
          number: row.truckNumber,
          licensePlate: row.licensePlate || '',
          make: row.make || '',
          model: row.model || '',
          year: parseInt(row.year || '0') || 0,
          vin: row.vin || '',
          status: 'available',
          ownership: 'owned'
        };

        addTruck(newTruck);
        return 'success';
      }
      return 'success';
    } catch (err: any) {
      return err.message || 'Unknown error';
    }
  };

  const confirmImport = async () => {
    setShowPreview(false);
    setShowFieldMapping(false);
    setImportProgress({
      visible: true,
      status: 'Processing...',
      percentage: 0,
      total: 0,
      success: 0,
      warnings: 0,
      errors: 0,
      errorList: []
    });

    let total = 0, success = 0, warnings = 0, errors = 0;
    const errorList: string[] = [];

    for (const file of selectedFiles) {
      try {
        const data = await parseFile(file);
        const transformed = transformData(data);
        total += transformed.length;

        for (let i = 0; i < transformed.length; i++) {
          const row = transformed[i];
          const result = await importRow(dataType, row, skipDuplicates);
          
          if (result === 'success') success++;
          else if (result === 'warning') warnings++;
          else {
            errors++;
            errorList.push(`Row ${i + 1}: ${result}`);
          }

          const progress = ((success + warnings + errors) / total) * 100;
          setImportProgress({
            visible: true,
            status: 'Processing...',
            percentage: Math.round(progress),
            total,
            success,
            warnings,
            errors,
            errorList: errorList.slice(-10)
          });
        }
      } catch (error: any) {
        errors++;
        errorList.push(`File ${file.name}: ${error.message}`);
      }
    }

    const historyEntry: ImportHistory = {
      id: Date.now().toString(),
      dateTime: new Date().toISOString(),
      type: dataType.charAt(0).toUpperCase() + dataType.slice(1),
      source: selectedFiles.map(f => f.name).join(', '),
      total,
      success,
      warnings,
      errors
    };

    const updatedHistory = [historyEntry, ...importHistory].slice(0, 20);
    setImportHistory(updatedHistory);
    localStorage.setItem('importHistory', JSON.stringify(updatedHistory));

    setImportProgress(prev => ({
      ...prev,
      status: 'Complete!',
      errorList: errorList.slice(-10)
    }));

    setTimeout(() => {
      setImportProgress(prev => ({ ...prev, visible: false }));
      setSelectedFiles([]);
      setParsedData([]);
      setFieldMapping({});
    }, 5000);
  };

  const downloadTemplate = () => {
    const templates: { [key: string]: string[][] } = {
      loads: [["Load Number", "Origin City", "Origin State", "Destination City", "Destination State", "Rate", "Miles", "Customer Name"]],
      drivers: [["First Name", "Last Name", "Phone", "Email", "Employee Type"]],
      expenses: [["Type", "Amount", "Date", "Description"]],
      fleet: [["Truck Number", "Make", "Model", "Year", "VIN"]]
    };

    const data = templates[dataType] || templates.loads;
    const csv = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ATS_${dataType}_Import_Template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = importHistory.reduce((acc, entry) => {
    acc.total += 1;
    if (entry.errors === 0) acc.success += 1;
    else acc.failed += 1;
    return acc;
  }, { total: 0, success: 0, failed: 0 });

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white shadow-sm border-b mb-6 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Data Import</h1>
            <p className="text-slate-600 mt-2">Import data from files or external sources</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Download size={18} />
            Download Template
          </button>
        </div>
      </div>

      {/* Import Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File Import */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText size={20} />
            File Import
          </h3>
          
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer mb-4 transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'
            }`}
          >
            <Upload size={48} className="mx-auto mb-4 text-slate-400" />
            <p className="text-lg font-medium text-slate-700 mb-2">Drop files here or click to browse</p>
            <p className="text-sm text-slate-500">CSV files up to 50MB</p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".csv"
              multiple
              onChange={handleFileSelect}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="mb-4 space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                  <span className="text-sm text-slate-700">{file.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Type</label>
              <select
                value={dataType}
                onChange={(e) => setDataType(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="loads">Loads</option>
                <option value="drivers">Drivers</option>
                <option value="expenses">Expenses</option>
                <option value="fleet">Fleet</option>
              </select>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-slate-700">Skip duplicates</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={validateData}
                onChange={(e) => setValidateData(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-slate-700">Validate data before import</span>
            </label>
            <button
              onClick={startFileImport}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              Start Import
            </button>
          </div>
        </div>

        {/* DAT Integration */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database size={20} />
            DAT Load Board
          </h3>
          <div className="flex justify-between items-center mb-3">
            <span className="font-medium text-slate-700">Status</span>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
              datStatus === 'Connected' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-slate-100 text-slate-800'
            }`}>
              {datStatus}
            </span>
          </div>
          <button
            onClick={() => {
              const key = prompt('Enter DAT API Key:');
              if (key) {
                localStorage.setItem('datApiKey', key);
                setDatStatus('Connected');
                alert('DAT API Key saved');
              }
            }}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 mb-2 flex items-center justify-center gap-2"
          >
            <Cloud size={18} />
            Configure API Key
          </button>
          <p className="text-xs text-slate-500 text-center mt-2">
            DAT integration coming soon
          </p>
        </div>

        {/* Import Stats */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={20} />
            Import Statistics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Total Imports</span>
              <span className="text-2xl font-bold text-blue-600">{stats.total}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Successful</span>
              <span className="text-2xl font-bold text-green-600">{stats.success}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Failed</span>
              <span className="text-2xl font-bold text-red-600">{stats.failed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Field Mapping Modal */}
      {showFieldMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Map Fields</h3>
              <button
                onClick={() => setShowFieldMapping(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">Map your file columns to system fields</p>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">File Column</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">System Field</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Sample Value</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.length > 0 && Object.keys(parsedData[0]).map((col) => (
                    <tr key={col} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-2 text-sm font-medium">{col}</td>
                      <td className="px-4 py-2">
                        <select
                          value={fieldMapping[col] || ''}
                          onChange={(e) => {
                            const newMapping = { ...fieldMapping };
                            if (e.target.value) {
                              newMapping[col] = e.target.value;
                            } else {
                              delete newMapping[col];
                            }
                            setFieldMapping(newMapping);
                          }}
                          className="w-full px-2 py-1 border rounded"
                        >
                          <option value="">-- Skip --</option>
                          {Object.keys(getSystemFields(dataType)).map(field => (
                            <option key={field} value={field}>{field}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600">
                        {String(parsedData[0][col] || '').substring(0, 30)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowFieldMapping(false)}
                className="px-4 py-2 border rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowFieldMapping(false);
                  setShowPreview(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Apply Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Preview Data</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">Review your data before importing (showing first 10 rows)</p>
            <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {parsedData.length > 0 && Object.keys(transformData(parsedData.slice(0, 1))[0] || {}).map(col => (
                      <th key={col} className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transformData(parsedData.slice(0, 10)).map((row, index) => (
                    <tr key={index} className="border-t">
                      {Object.values(row).map((val: any, i) => (
                        <td key={i} className="px-4 py-2 text-sm">
                          {String(val || '').substring(0, 50)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle size={18} />
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Progress */}
      {importProgress.visible && (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <div className="flex justify-between mb-4">
            <h3 className="text-lg font-semibold">Import Progress</h3>
            <button
              onClick={() => setImportProgress(prev => ({ ...prev, visible: false }))}
              className="text-red-600"
            >
              <X size={20} />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>{importProgress.status}</span>
                <span>{importProgress.percentage}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${importProgress.percentage}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4 text-center text-sm">
              <div>
                <div className="text-2xl font-bold text-blue-600">{importProgress.total}</div>
                <div>Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{importProgress.success}</div>
                <div>Success</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{importProgress.warnings}</div>
                <div>Warnings</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{importProgress.errors}</div>
                <div>Errors</div>
              </div>
            </div>
            {importProgress.errorList.length > 0 && (
              <div className="mt-4 max-h-40 overflow-y-auto">
                <h4 className="font-semibold text-red-600 mb-2">Errors:</h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {importProgress.errorList.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Imports */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Recent Imports</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Records</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {importHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No import history yet
                  </td>
                </tr>
              ) : (
                importHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-4 text-sm">
                      {new Date(entry.dateTime).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm">{entry.type}</td>
                    <td className="px-6 py-4 text-sm">{entry.source}</td>
                    <td className="px-6 py-4 text-sm">{entry.total}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        entry.errors > 0 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {entry.errors > 0 ? 'Failed' : 'Success'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Import;

