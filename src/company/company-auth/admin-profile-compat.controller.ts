import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from '@nestjs/common';

@Controller()
export class AdminProfileCompatController {
  private runtimeProfileOverrides: Record<string, string> = {};

  private getAdminEmail() {
    return (
      process.env.ADMIN_EMAIL ||
      process.env.MAIL_USERNAME ||
      'thanujamallakuntaa@gmail.com'
    )
      .trim()
      .toLowerCase();
  }

  private getAdminProfile() {
    const fullName = (process.env.ADMIN_NAME || 'Super Admin').trim();
    const [firstName, ...rest] = fullName.split(' ');
    const lastName = rest.join(' ');
    return {
      id: 'admin',
      role: 'A',
      first_name: this.runtimeProfileOverrides.first_name || firstName || 'Super',
      last_name: this.runtimeProfileOverrides.last_name || lastName || 'Admin',
      name: this.runtimeProfileOverrides.name || fullName,
      email: this.getAdminEmail(),
      phone: this.runtimeProfileOverrides.phone || process.env.ADMIN_PHONE || '',
      organization:
        this.runtimeProfileOverrides.organization || process.env.ADMIN_ORGANIZATION || 'GreenCo CII',
      designation:
        this.runtimeProfileOverrides.designation || process.env.ADMIN_DESIGNATION || 'Super Admin',
      address: this.runtimeProfileOverrides.address || process.env.ADMIN_ADDRESS || '',
      city: this.runtimeProfileOverrides.city || process.env.ADMIN_CITY || '',
      state: this.runtimeProfileOverrides.state || process.env.ADMIN_STATE || '',
      pincode: this.runtimeProfileOverrides.pincode || process.env.ADMIN_PINCODE || '',
    };
  }

  @Get('api/admin/me')
  @Get('admin/me')
  async getAdminMe() {
    return {
      status: 'success',
      message: 'Admin profile',
      data: this.getAdminProfile(),
    };
  }

  @Post('api/admin/profile')
  @Post('admin/profile')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: false, forbidNonWhitelisted: false }))
  async updateAdminProfile(@Body() body: Record<string, any>) {
    const allowedKeys = [
      'first_name',
      'last_name',
      'name',
      'phone',
      'organization',
      'designation',
      'address',
      'city',
      'state',
      'pincode',
    ];

    for (const key of allowedKeys) {
      if (body?.[key] !== undefined && body?.[key] !== null) {
        this.runtimeProfileOverrides[key] = String(body[key]).trim();
      }
    }

    return {
      status: 'success',
      message: 'Profile updated successfully',
      data: this.getAdminProfile(),
    };
  }
}

