import Notification from '../schemas/Notification';
import User from '../models/User';

class NotificationController {
  async index(req, res) {
    const id = req.userId;

    const isProvider = await User.findOne({ where: { id, provider: true } });

    if (!isProvider) {
      return res
        .status(400)
        .json({ error: 'Only provider can load notifications!' });
    }

    const notifications = await Notification.find({ user: id })
      .sort({ createdAt: 'desc' })
      .limit(20);

    return res.json(notifications);
  }

  async update(req, res) {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );

    return res.json(notification);
  }
}

export default new NotificationController();
