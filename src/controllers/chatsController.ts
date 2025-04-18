import { Request, Response, NextFunction } from "express";
import { Chat } from "../models/chats";
import { User } from "../models/user";
import dbConnect from "../config/database";
import { validationResult } from "express-validator";
import ErrorHandler from "../utils/errorHandler";
import { UserRequest } from "../middlewares/authenticate";
import { Message } from "../models/messages";

// Create a Chat for Two Participants
export const createChat = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ErrorHandler("Validation errors", 400);
    }

    const { participants } = req.body;

    // Ensure exactly two participants
    if (!participants || participants.length !== 2) {
      throw new ErrorHandler("Exactly two participants are required", 400);
    }

    if (new Set(participants).size !== participants.length) {
      throw new ErrorHandler("Participants cannot be duplicate", 400);
    }

    const userRepo = dbConnect.getRepository(User);
    const chatRepo = dbConnect.getRepository(Chat);

    // Verify that all participants exist in the system
    const users = await userRepo.findByIds(participants);
    if (users.length !== participants.length) {
      throw new ErrorHandler("One or more participants not found", 404);
    }

    // Check if a chat with the same participants already exists
    const existingChat = await chatRepo
      .createQueryBuilder("chat")
      .innerJoin("chat.participants", "participant")
      .where("participant.id IN (:...participants)", { participants })
      .groupBy("chat.id")
      .having("COUNT(participant.id) = :count", { count: participants.length })
      .getOne();

    if (existingChat) {
      throw new ErrorHandler(
        "A chat with these participants already exists",
        400
      );
    }

    // Create a new chat
    const newChat = new Chat();
    newChat.participants = users;

    const savedChat = await chatRepo.save(newChat);

    res.json({
      success: true,
      message: "Chat created successfully",
      data: savedChat,
    });
  } catch (error) {
    next(error);
  }
};

// Get All Chats for A User
export const getChats = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const chatRepo = dbConnect.getRepository(Chat);

    const chats = await chatRepo
      .createQueryBuilder("chat")
      .leftJoinAndSelect("chat.participants", "user")
      .where(
        "chat.id IN (SELECT cp.chat_id FROM chat_participants cp WHERE cp.user_id = :userId)",
        { userId }
      )
      .getMany();

    res.json({
      success: true,
      data: chats,
    });
  } catch (error) {
    next(error);
  }
};

// Get a single chat by ID
export const getChat = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const chatRepo = dbConnect.getRepository(Chat);
    const chat = await chatRepo.findOne({
      where: { id: chatId },
      relations: ["participants", "messages", "messages.sender"], // Load sender relation
    });

    if (!chat) {
      throw new ErrorHandler("Chat not found", 404);
    }

    // Ensure the user is a participant of the chat
    if (!chat.participants.some((user) => user.id === userId)) {
      throw new ErrorHandler("You are not a participant of this chat", 403);
    }

    res.json({
      success: true,
      data: chat,
    });
  } catch (error) {
    next(error);
  }
};

// Delete A Chat
export const deleteChat = async (
  req: UserRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      throw new ErrorHandler("Unauthorized access", 401);
    }

    const chatRepo = dbConnect.getRepository(Chat);
    const messageRepo = dbConnect.getRepository(Message);

    // Find the chat with participants
    const chat = await chatRepo.findOne({
      where: { id: chatId },
      relations: ["participants", "messages"],
    });

    if (!chat) {
      throw new ErrorHandler("Chat not found", 404);
    }

    // Ensure the user is a participant of the chat
    if (!chat.participants.some((user) => user.id === userId)) {
      throw new ErrorHandler("You are not a participant of this chat", 403);
    }

    // Delete all messages in the chat
    await messageRepo.delete({ chat: { id: chatId } });

    // Delete the chat
    await chatRepo.remove(chat);

    res.json({
      success: true,
      message: "Chat and its messages deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
