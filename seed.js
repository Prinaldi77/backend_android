// C:/FOLDER KULIAH/backend_android/seed.js

const supabaseAdmin = require('./src/config/supabaseAdmin');

async function seed() {
  if (!supabaseAdmin) {
    console.error("❌ supabaseAdmin is not configured");
    return;
  }

  const usersToCreate = [
    {
      email: 'pembina@scoutify.com',
      password: 'password123',
      name: 'Kak Ahmad',
      role: 'PEMBINA',
      nomorInduk: 'PEMBINA001',
      gugusDepan: 'Ambalan Soekarno',
    },
    {
      email: 'siswa@scoutify.com',
      password: 'password123',
      name: 'Kak Budi',
      role: 'SISWA',
      nomorInduk: 'SISWA001',
      gugusDepan: 'Ambalan Soekarno',
      regu: 'Regu Rajawali'
    }
  ];

  for (const u of usersToCreate) {
    console.log(`\nProcessing user: ${u.email}...`);

    // Check if user already exists in profiles
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', u.email)
      .maybeSingle();

    if (existingProfile) {
      console.log(`ℹ️ User ${u.email} already exists in profiles. Ensuring role is set to ${u.role}...`);
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: u.role, is_active: true })
        .eq('id', existingProfile.id);
      
      if (updateError) {
        console.error(`❌ Failed to update role:`, updateError.message);
      } else {
        console.log(`✅ Role successfully updated / confirmed.`);
      }
      continue;
    }

    // 1. Create in auth bypassing confirmation email
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true
    });

    if (authError) {
      console.error(`❌ Error creating auth user ${u.email}:`, authError.message);
      continue;
    }

    const userId = authData.user.id;
    console.log(`🔑 Auth user created with ID: ${userId}`);

    // 2. Insert into profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        id: userId,
        name: u.name,
        email: u.email,
        role: u.role,
        nomor_induk: u.nomorInduk,
        gugus_depan: u.gugusDepan,
        regu: u.regu || null,
        is_active: true
      }]);

    if (profileError) {
      console.error(`❌ Error creating profile record:`, profileError.message);
      // Clean up auth user to allow retrying
      await supabaseAdmin.auth.admin.deleteUser(userId);
    } else {
      console.log(`✅ Successfully created profile record for role ${u.role}.`);
    }
  }
  console.log("\nSeeding finished!");
}

seed();
