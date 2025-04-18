import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from "typeorm";
import { User } from "./user";
import { RolePermission } from "./role_permissions";

@Entity("roles")
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 50, unique: true })
  roleName!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  description?: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @OneToMany(() => User, (user) => user.role)
  users!: User[];

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions!: RolePermission[];
}
