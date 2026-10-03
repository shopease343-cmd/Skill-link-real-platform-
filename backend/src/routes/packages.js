import { Router } from 'express';
import { query } from '../lib/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `select id, code, name, subtitle, price_paise, description,
              access_days, is_active, is_featured
       from packages
       where is_active = true
       order by display_order asc`
    );
    res.json({ packages: result.rows });
  } catch (err) {
    next(err);
  }
});

export default router;
