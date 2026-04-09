import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Company, CompanyDocument } from '../schemas/company.schema';
import {
  CompanyProject,
  CompanyProjectDocument,
} from '../schemas/company-project.schema';
import {
  CompanyFacilitator,
  CompanyFacilitatorDocument,
} from '../schemas/company-facilitator.schema';
import {
  CompanyActivity,
  CompanyActivityDocument,
} from '../schemas/company-activity.schema';
import { Facilitator, FacilitatorDocument } from '../schemas/facilitator.schema';
import { MailService } from '../../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { passwordGeneration } from '../../helpers/password.helper';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class CompanyAuthService {
  constructor(
    @InjectModel(Company.name) private companyModel: Model<CompanyDocument>,
    @InjectModel(CompanyProject.name)
    private companyProjectModel: Model<CompanyProjectDocument>,
    @InjectModel(CompanyFacilitator.name)
    private companyFacilitatorModel: Model<CompanyFacilitatorDocument>,
    @InjectModel(CompanyActivity.name)
    private companyActivityModel: Model<CompanyActivityDocument>,
    @InjectModel(Facilitator.name)
    private facilitatorModel: Model<FacilitatorDocument>,
    private jwtService: JwtService,
    private mailService: MailService,
    private notificationsService: NotificationsService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Check if email already exists
    const existingEmail = await this.companyModel.findOne({
      email: registerDto.email.toLowerCase(),
    });
    if (existingEmail) {
      throw new ConflictException({
        status: 'error',
        message: 'Email already exists',
      });
    }

    // Check if mobile already exists
    const existingMobile = await this.companyModel.findOne({
      mobile: registerDto.mobileno,
    });
    if (existingMobile) {
      throw new ConflictException({
        status: 'error',
        message: 'Mobile number already exists',
      });
    }

    // Validate mobile number format
    if (!/^[6-9]\d{9}$/.test(registerDto.mobileno)) {
      throw new BadRequestException({
        status: 'error',
        message: 'Validation failed',
        errors: {
          mobileno: ['The mobile number must start with 6, 7, 8, or 9'],
        },
      });
    }

    // Validate facilitator if facilitator type is selected
    if (registerDto.assessment === 'facilitator' && registerDto.selectfacilitator) {
      const facilitator = await this.facilitatorModel.findById(
        registerDto.selectfacilitator,
      );
      if (!facilitator || facilitator.status !== '1') {
        throw new BadRequestException({
          status: 'error',
          message: 'Validation failed',
          errors: {
            selectfacilitator: ['The selected facilitator is invalid or inactive'],
          },
        });
      }
    }

    // Generate password
    const generatedPassword = passwordGeneration(12);

    // Hash password
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    let savedCompany: CompanyDocument | null = null;
    let savedProject: CompanyProjectDocument | null = null;
    let facilitatorAssigned = false;
    try {
      // Create company
      const company = new this.companyModel({
        email: registerDto.email.toLowerCase(),
        password: hashedPassword,
        mobile: registerDto.mobileno,
        name: registerDto.company_name,
        account_status: '1',
        verified_status: '0',
      });
      savedCompany = await company.save();

      // Create project
      const project = new this.companyProjectModel({
        company_id: savedCompany._id,
        process_type: registerDto.assessment === 'cii' ? 'c' : 'f',
        next_activities_id: 1,
      });
      savedProject = await project.save();

      // Log initial CII activity: Milestone 1 completed (registration)
      await this.companyActivityModel.create({
        company_id: savedCompany._id,
        project_id: savedProject._id,
        description: 'Plant registers for GreenCo Rating Online',
        activity_type: 'cii',
        milestone_flow: 1,
        milestone_completed: true,
      });

      // Set next milestone to step 2 (GreenCo Launch & Handholding)
      savedProject.next_activities_id = 2;
      await savedProject.save();

      // Create facilitator assignment if assessment is facilitator
      if (registerDto.assessment === 'facilitator' && registerDto.selectfacilitator) {
        const facilitator = new this.companyFacilitatorModel({
          company_id: savedCompany._id,
          project_id: savedProject._id,
          facilitator_id: new Types.ObjectId(registerDto.selectfacilitator),
        });
        await facilitator.save();
        facilitatorAssigned = true;
      }

      // Make registration email mandatory for successful registration response.
      await this.mailService.sendCompanyRegistrationEmail(
        savedCompany.email,
        savedCompany.name,
        generatedPassword,
      );
    } catch (error) {
      // Rollback data created during this request so user can retry registration safely.
      if (savedProject?._id) {
        await this.companyActivityModel
          .deleteMany({ project_id: savedProject._id })
          .catch((cleanupErr) => console.error('Cleanup companyActivity failed:', cleanupErr));
      }
      if (facilitatorAssigned && savedProject?._id) {
        await this.companyFacilitatorModel
          .deleteMany({ project_id: savedProject._id })
          .catch((cleanupErr) => console.error('Cleanup companyFacilitator failed:', cleanupErr));
      }
      if (savedProject?._id) {
        await this.companyProjectModel
          .deleteOne({ _id: savedProject._id })
          .catch((cleanupErr) => console.error('Cleanup companyProject failed:', cleanupErr));
      }
      if (savedCompany?._id) {
        await this.companyModel
          .deleteOne({ _id: savedCompany._id })
          .catch((cleanupErr) => console.error('Cleanup company failed:', cleanupErr));
      }

      console.error('Registration failed, rolled back company data:', error);
      throw new InternalServerErrorException({
        status: 'error',
        message:
          'Registration email could not be sent. Please verify mail configuration and try again.',
      });
    }

    // In-app: notify Admin (New Company Registered)
    this.notificationsService
      .create(
        'New Company Registered',
        `Company ${savedCompany.name} Registered`,
        'A',
        null,
      )
      .catch((err) => console.error('Notification create failed:', err));

    // In-app: notify Company (credentials / next steps)
    this.notificationsService
      .create(
        'Registration successful',
        'You have been registered. Check your email for login credentials and next steps.',
        'C',
        savedCompany._id.toString(),
      )
      .catch((err) => console.error('Notification to company failed:', err));

    return {
      status: 'success',
      message: 'Company Registered Successfully.',
    };
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const password = loginDto.password.trim();

    const company = await this.companyModel.findOne({ email }).select('+password');

    if (!company) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'No Account Found! Please enter a valid Email.',
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, company.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException({
        status: 'error',
        message:
          'Your credentials are not valid! Please enter a valid Email and Password.',
      });
    }

    // Check account status
    if (company.account_status !== '1') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account In-Active! Please Contact Greenco Team.',
      });
    }

    // Get project
    const project = await this.companyProjectModel.findOne({
      company_id: company._id,
    });

    // Generate JWT token
    const payload = {
      sub: company._id.toString(),
      email: company.email,
    };

    const token = this.jwtService.sign(payload);

    return {
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: company._id.toString(),
          name: company.name,
          email: company.email,
          mobile: company.mobile,
          account_status: company.account_status,
          verified_status: company.verified_status,
        },
        project: project
          ? {
              id: project._id.toString(),
              name: company.name,
              next_activities_id: project.next_activities_id,
            }
          : null,
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const company = await this.companyModel.findOne({
      email: forgotPasswordDto.email.toLowerCase(),
    });

    if (!company) {
      throw new BadRequestException({
        status: 'errors',
        errors: {
          email: ["Account doesn't exist. Please Signup to register."],
        },
      });
    }

    if (company.account_status !== '1') {
      throw new BadRequestException({
        status: 'errors',
        errors: {
          email: ['Account In-Active! Please Contact Greenco Team.'],
        },
      });
    }

    // Generate new password
    const newPassword = passwordGeneration(12);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    company.password = hashedPassword;
    await company.save();

    // Send email (must succeed, otherwise return error to frontend)
    try {
      await this.mailService.sendForgotPasswordEmail(
        company.email,
        newPassword,
      );
    } catch (error) {
      console.error('Error sending forgot password email:', error);
      throw new BadRequestException({
        status: 'error',
        message: 'Failed to send email. Please try again later.',
      });
    }

    return {
      status: 'success',
      message: 'Password sent to your email!',
    };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ) {
    const company = await this.companyModel.findById(userId).select('+password');

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.current_password,
      company.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException({
        status: 'error',
        message:
          'Your current password does not matches with the password you provided. Please try again.',
      });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(
      changePasswordDto.new_password,
      company.password,
    );

    if (isSamePassword) {
      throw new BadRequestException({
        status: 'error',
        message:
          'New Password cannot be same as your current password. Please choose a different password.',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(changePasswordDto.new_password, 10);

    // Update password
    company.password = hashedPassword;
    await company.save();

    // Send email notification in background (non-blocking)
    this.mailService
      .sendPasswordUpdateEmail(company.email, company.name)
      .catch((error) => {
        console.error('Error sending password update email:', error);
        // Don't fail if email fails
      });

    return {
      status: 'success',
      message: 'Success! Your new Password has been updated successfully.',
    };
  }

  async getCurrentUser(userId: string) {
    const company = await this.companyModel.findById(userId);

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const project = await this.companyProjectModel.findOne({
      company_id: company._id,
    });

    return {
      status: 'success',
      data: {
        id: company._id.toString(),
        name: company.name,
        email: company.email,
        mobile: company.mobile,
        account_status: company.account_status,
        verified_status: company.verified_status,
        project: project
          ? {
              id: project._id.toString(),
              next_activities_id: project.next_activities_id,
              process_type: project.process_type,
            }
          : null,
      },
    };
  }

  async getCompaniesList(searchTerm?: string) {
    const query: any = {};
    if (searchTerm) {
      query.name = { $regex: searchTerm, $options: 'i' };
    }

    const companies = await this.companyModel.find(query).select('name').limit(20);

    return companies.map((company) => ({
      value: company.name,
    }));
  }

  async getSubmittedCompanies(searchTerm?: string) {
    const query: any = {};
    if (searchTerm) {
      query.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { mobile: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    const companies = await this.companyModel
      .find(query)
      .sort({ createdAt: -1 })
      .select('name email mobile account_status verified_status createdAt')
      .lean();

    return {
      status: 'success',
      message: 'Submitted companies retrieved successfully',
      data: companies.map((company: any, index: number) => ({
        sno: index + 1,
        id: company._id.toString(),
        name: company.name || '',
        email: company.email || '',
        mobile: company.mobile || '',
        account_status: company.account_status || '0',
        verified_status: company.verified_status || '0',
        created_at: company.createdAt || null,
      })),
    };
  }
}

