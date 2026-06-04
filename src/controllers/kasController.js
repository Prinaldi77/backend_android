const supabase = require('../config/supabaseClient');
const { logAudit } = require('../utils/auditLogger');

const kasController = {
  // GET /api/kas
  getAllKas: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('kas')
        .select(`
          id,
          amount,
          type,
          description,
          created_at,
          user_id,
          profiles ( name, role )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      return res.status(200).json({
        success: true,
        message: 'Success retrieving kas records',
        data
      });
    } catch (err) {
      console.error('Error getAllKas:', err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/kas/summary
  getKasSummary: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('kas')
        .select('amount, type');

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      let totalSaldo = 0;
      let totalPemasukan = 0;
      let totalPengeluaran = 0;

      data.forEach(record => {
        if (record.type === 'IN') {
          totalSaldo += record.amount;
          totalPemasukan += record.amount;
        } else if (record.type === 'OUT') {
          totalSaldo -= record.amount;
          totalPengeluaran += record.amount;
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Success retrieving kas summary',
        data: {
          saldo: totalSaldo,
          pemasukan: totalPemasukan,
          pengeluaran: totalPengeluaran
        }
      });
    } catch (err) {
      console.error('Error getKasSummary:', err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // POST /api/kas
  addKas: async (req, res) => {
    try {
      const { amount, type, description } = req.body;
      const userId = req.user.sub;

      if (!amount || !type || !description) {
        return res.status(400).json({ success: false, message: 'amount, type (IN/OUT), and description are required', data: null });
      }

      const { data, error } = await supabase
        .from('kas')
        .insert([{
          user_id: userId,
          amount: Number(amount),
          type: type.toUpperCase(),
          description
        }])
        .select()
        .single();

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      await logAudit(userId, 'Add Kas', req.ip, `Added Kas ${type} of amount ${amount}`);

      return res.status(201).json({
        success: true,
        message: 'Kas record added successfully',
        data
      });
    } catch (err) {
      console.error('Error addKas:', err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  }
};

module.exports = kasController;
