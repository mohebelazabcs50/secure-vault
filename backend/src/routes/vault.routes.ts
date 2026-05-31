import { Router, Request, Response } from 'express';
import { VaultController } from '../controllers/vault.controller';
import { PwnedService } from '../services/pwned.service';
import { validateRequest } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import {
  AddVaultItemSchema,
  UpdateVaultItemSchema,
  ChangeMasterPasswordSchema,
  Enable2FASchema,
  Disable2FASchema,
  DeleteAccountSchema,
} from '../middleware/schemas';

const router = Router();

// Apply auth protection to all vault routes
router.use(authenticate);

// Vault Items CRUD
router.post('/items', validateRequest(AddVaultItemSchema), VaultController.addVaultItem);
router.get('/items', VaultController.getVaultItems);
router.put('/items/:id', validateRequest(UpdateVaultItemSchema), VaultController.updateVaultItem);
router.delete('/items/:id', VaultController.deleteVaultItem);

// Export Vault
router.get('/export', VaultController.exportVault);

// Activity Logs
router.get('/logs', VaultController.getActivityLogs);

// Password Security Breach Check (Have I Been Pwned API)
router.post('/check-breach', async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required to check for leaks.' });
    }
    const leakCount = await PwnedService.checkPasswordBreach(password);
    return res.status(200).json({ leaked: leakCount > 0, count: leakCount });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to perform leak check.' });
  }
});

// Master Password Rotation
router.post('/change-master', validateRequest(ChangeMasterPasswordSchema), VaultController.changeMasterPassword);

// 2FA Management
router.post('/2fa/setup', VaultController.setup2FA);
router.post('/2fa/enable', validateRequest(Enable2FASchema), VaultController.enable2FA);
router.post('/2fa/disable', validateRequest(Disable2FASchema), VaultController.disable2FA);

// Account deletion
router.post('/delete-account', validateRequest(DeleteAccountSchema), VaultController.deleteAccount);

export default router;
