
import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Truck, 
  Plus, 
  Edit, 
  Trash2,
  Phone,
  Mail,
  MapPin,
  User,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import type { Supplier, CreateSupplierInput, UpdateSupplierInput } from '../../../server/src/schema';

export function SupplierManagement() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [formData, setFormData] = useState<CreateSupplierInput>({
    name: '',
    contact_person: null,
    phone: null,
    email: null,
    address: null
  });

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const loadSuppliers = useCallback(async () => {
    try {
      const suppliersData = await trpc.getSuppliers.query();
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      showNotification('error', 'Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: null,
      phone: null,
      email: null,
      address: null
    });
    setEditingSupplier(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address
    });
    setEditingSupplier(supplier);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingSupplier) {
        const updateData: UpdateSupplierInput = {
          id: editingSupplier.id,
          ...formData
        };
        const updatedSupplier = await trpc.updateSupplier.mutate(updateData);
        setSuppliers((prev: Supplier[]) => 
          prev.map((s: Supplier) => s.id === editingSupplier.id ? updatedSupplier : s)
        );
        showNotification('success', 'Supplier updated successfully');
      } else {
        const newSupplier = await trpc.createSupplier.mutate(formData);
        setSuppliers((prev: Supplier[]) => [...prev, newSupplier]);
        showNotification('success', 'Supplier created successfully');
      }
      closeDialog();
    } catch (error) {
      console.error('Failed to save supplier:', error);
      showNotification('error', 'Failed to save supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (supplierId: number) => {
    if (!confirm('Are you sure you want to delete this supplier? This action cannot be undone.')) {
      return;
    }

    try {
      await trpc.deleteSupplier.mutate(supplierId);
      setSuppliers((prev: Supplier[]) => prev.filter((s: Supplier) => s.id !== supplierId));
      showNotification('success', 'Supplier deleted successfully');
    } catch (error) {
      console.error('Failed to delete supplier:', error);
      showNotification('error', 'Failed to delete supplier');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading suppliers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <Alert className={notification.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {notification.type === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={notification.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {notification.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <Truck className="w-8 h-8 mr-3 text-blue-600" />
          Supplier Management
        </h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </DialogTitle>
              <DialogDescription>
                {editingSupplier ? 'Update supplier information' : 'Enter supplier details'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Supplier Name *</label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateSupplierInput) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Enter supplier name"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Contact Person</label>
                <Input
                  type="text"
                  value={formData.contact_person || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateSupplierInput) => ({ 
                      ...prev, 
                      contact_person: e.target.value || null 
                    }))
                  }
                  placeholder="Enter contact person name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Phone</label>
                  <Input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateSupplierInput) => ({ 
                        ...prev, 
                        phone: e.target.value || null 
                      }))
                    }
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Email</label>
                  <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateSupplierInput) => ({ 
                        ...prev, 
                        email: e.target.value || null 
                      }))
                    }
                    placeholder="Email address"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Address</label>
                <Textarea
                  value={formData.address || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev: CreateSupplierInput) => ({ 
                      ...prev, 
                      address: e.target.value || null 
                    }))
                  }
                  placeholder="Enter supplier address"
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingSupplier ? 'Updating...' : 'Creating...'}
                    </div>
                  ) : (
                    editingSupplier ? 'Update Supplier' : 'Create Supplier'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Suppliers ({suppliers.length})</CardTitle>
          <CardDescription>Manage your product suppliers and their contact information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier: Supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>
                      {supplier.contact_person ? (
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2 text-gray-400" />
                          {supplier.contact_person}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Not specified</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {supplier.phone && (
                          <div className="flex items-center text-sm">
                            <Phone className="w-3 h-3 mr-2 text-gray-400" />
                            {supplier.phone}
                          </div>
                        )}
                        {supplier.email && (
                          <div className="flex items-center text-sm">
                            <Mail className="w-3 h-3 mr-2 text-gray-400" />
                            {supplier.email}
                          </div>
                        )}
                        {!supplier.phone && !supplier.email && (
                          <span className="text-gray-400 italic text-sm">No contact info</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {supplier.address ? (
                        <div className="flex items-center max-w-xs">
                          <MapPin className="w-3 h-3 mr-2 text-gray-400 flex-shrink-0" />
                          <p className="text-sm text-gray-600 truncate">{supplier.address}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-sm">No address</span>
                      )}
                    </TableCell>
                    <TableCell>{supplier.created_at.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(supplier)}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(supplier.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {suppliers.length === 0 && (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No suppliers yet. Add your first supplier to manage product sourcing!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
