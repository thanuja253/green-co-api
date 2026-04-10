import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { Assessor, AssessorDocument } from '../../company/schemas/assessor.schema';
import {
  CompanyAssessor,
  CompanyAssessorDocument,
} from '../../company/schemas/company-assessor.schema';
import {
  CompanyProject,
  CompanyProjectDocument,
} from '../../company/schemas/company-project.schema';
import { AssessorLoginDto } from './dto/assessor-login.dto';
import { AssessorForgotPasswordDto } from './dto/assessor-forgot-password.dto';
import { AssessorChangePasswordDto } from './dto/assessor-change-password.dto';
import { passwordGeneration } from '../../helpers/password.helper';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class AssessorAuthService {
  constructor(
    @InjectModel(Assessor.name) private assessorModel: Model<AssessorDocument>,
    @InjectModel(CompanyAssessor.name)
    private companyAssessorModel: Model<CompanyAssessorDocument>,
    @InjectModel(CompanyProject.name)
    private companyProjectModel: Model<CompanyProjectDocument>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async login(loginDto: AssessorLoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const assessor = await this.assessorModel.findOne({ email }).select('+password');
    if (!assessor || !assessor.password) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'No Account Found! Please enter a valid Email.',
      });
    }
    const ok = await bcrypt.compare(loginDto.password.trim(), assessor.password);
    if (!ok) {
      throw new UnauthorizedException({
        status: 'error',
        message:
          'Your credentials are not valid! Please enter a valid Email and Password.',
      });
    }
    if (assessor.status !== '1') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account In-Active! Please Contact Greenco Team.',
      });
    }
    if (assessor.verification_status === '2') {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Your account is disapproved. Please contact admin.',
      });
    }
    const token = this.jwtService.sign({
      sub: assessor._id.toString(),
      email: assessor.email,
      role: 'assessor',
    });
    return {
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        user: {
          id: assessor._id.toString(),
          name: assessor.name,
          email: assessor.email,
          mobile: assessor.mobile || null,
          status: assessor.status,
          verification_status: assessor.verification_status || '0',
        },
      },
    };
  }

  async forgotPassword(dto: AssessorForgotPasswordDto) {
    const assessor = await this.assessorModel
      .findOne({ email: dto.email.trim().toLowerCase() })
      .select('+password');
    if (!assessor) {
      throw new BadRequestException({
        status: 'errors',
        errors: { email: ["Account doesn't exist. Please contact administrator."] },
      });
    }
    if (assessor.status !== '1' || assessor.verification_status === '2') {
      throw new BadRequestException({
        status: 'errors',
        errors: { email: ['Account In-Active! Please Contact Greenco Team.'] },
      });
    }
    const newPassword = passwordGeneration(12);
    assessor.password = await bcrypt.hash(newPassword, 10);
    await assessor.save();
    await this.mailService.sendForgotPasswordEmail(assessor.email, newPassword);
    return { status: 'success', message: 'Password sent to your email!' };
  }

  async changePassword(userId: string, dto: AssessorChangePasswordDto) {
    const assessor = await this.assessorModel.findById(userId).select('+password');
    if (!assessor || !assessor.password) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }
    const currentOk = await bcrypt.compare(dto.current_password, assessor.password);
    if (!currentOk) {
      throw new BadRequestException({
        status: 'error',
        message:
          'Your current password does not matches with the password you provided. Please try again.',
      });
    }
    const same = await bcrypt.compare(dto.new_password, assessor.password);
    if (same) {
      throw new BadRequestException({
        status: 'error',
        message:
          'New Password cannot be same as your current password. Please choose a different password.',
      });
    }
    assessor.password = await bcrypt.hash(dto.new_password, 10);
    await assessor.save();
    return {
      status: 'success',
      message: 'Success! Your new Password has been updated successfully.',
    };
  }

  async me(userId: string) {
    const assessor = await this.assessorModel.findById(userId);
    if (!assessor) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Unauthorized. Please check your credentials.',
      });
    }
    return { status: 'success', data: assessor };
  }

  async myProjects(userId: string) {
    const links = await this.companyAssessorModel
      .find({ assessor_id: userId })
      .sort({ createdAt: -1 });
    const projectIds = links.map((l) => l.project_id);
    const projects = await this.companyProjectModel.find({ _id: { $in: projectIds } });
    return {
      status: 'success',
      data: links.map((l) => ({
        assessor_assignment_id: l._id,
        project_id: l.project_id,
        company_id: l.company_id,
        visit_dates: l.visit_dates || [],
        project: projects.find((p) => p._id.toString() === l.project_id.toString()) || null,
      })),
    };
  }
}
